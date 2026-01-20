import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Button, Alert, Badge, Modal, Form, ProgressBar, Table, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import api, { refreshCSRFToken } from '../../utils/api';
import { CheckCircle, Camera, User } from 'lucide-react';
import FaceVerificationModal from '../../components/FaceVerificationModal';
import io from 'socket.io-client';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';
import '../../styles/modern-ui.css';
import { useTranslation } from 'react-i18next';

const StudentExams = () => {
  const { t } = useTranslation();
  usePageTitle(t('studentExams.title'));
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [pendingExam, setPendingExam] = useState(null); // Exam waiting for regulation confirmation
  const { showAlert } = useAlert();
  const [showStartModal, setShowStartModal] = useState(false);
  const [examPassword, setExamPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [webcamModalError, setWebcamModalError] = useState('');
  const [currentAttempt, setCurrentAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [answerTimestamps, setAnswerTimestamps] = useState({}); // Lưu timestamp khi chọn đáp án
  const answersRef = useRef({}); // Store answers in ref for timer callback
  const answerTimestampsRef = useRef({}); // Store answerTimestamps in ref for timer callback
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timeRemainingRef = useRef(0); // Store timeRemaining in ref for immediate access
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);
  const [examQuestions, setExamQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [questionsPerPage, setQuestionsPerPage] = useState('all');
  const [imsExamPctuFiles, setImsExamPctuFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const [webcamError, setWebcamError] = useState(null);
  const [isWebcamRecording, setIsWebcamRecording] = useState(false);
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const chunkIntervalRef = useRef(null);
  const attemptIdRef = useRef(null); // Store attempt_id for timer callback
  const socketRef = useRef(null); // Socket.io connection for ban events

  // Face verification states (simplified - most logic moved to FaceVerificationModal component)
  const [showFaceVerificationModal, setShowFaceVerificationModal] = useState(false);
  const [hasFaceSample, setHasFaceSample] = useState(null);
  const [showFaceSampleRequiredModal, setShowFaceSampleRequiredModal] = useState(false);
  const [faceVerificationResult, setFaceVerificationResult] = useState(null);
  const [showBacktrackWarning, setShowBacktrackWarning] = useState(false);
  const warningAlertRef = useRef(null); // Ref for warning alert to detect outside clicks
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false); // Show confirm OK button
  const examActionsRef = useRef(null); // Ref for exam actions container to detect outside clicks

  // Cheating detection refs
  const tabSwitchCountRef = useRef(0);
  const lastVisibilityChangeRef = useRef(null);
  const isTrackingActiveRef = useRef(false);
  const cheatingLogQueueRef = useRef([]);

  // Auto-refresh refs
  const pollingIntervalRef = useRef(null);
  const lastExamsHashRef = useRef(null);
  const isPollingActiveRef = useRef(false);

  // Exam Regulation states
  const [showRegulationModal, setShowRegulationModal] = useState(false);
  const [examRegulation, setExamRegulation] = useState(null);
  const [regulationConfirmation, setRegulationConfirmation] = useState(null);
  const [readingStartTime, setReadingStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [canConfirm, setCanConfirm] = useState(false);
  const readingIntervalRef = useRef(null);

  // Check exam regulation on component load
  // Note: If require_read_each_time is true, skip checking here because it will be checked when clicking "Làm bài" button
  const checkExamRegulation = async () => {
    try {
      const response = await api.get('/lms/exam-regulation');
      if (response.data.success && response.data.data) {
        const regulation = response.data.data;
        setExamRegulation(regulation);
        
        // If require_read_each_time is true, skip checking here
        // The regulation will be checked when student clicks "Làm bài" button
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

  useEffect(() => {
    fetchExams();
    startAutoRefresh();
    checkExamRegulation();
    
    // Check if opened from IMS EXAM PCTU app
    const urlParams = new URLSearchParams(window.location.search);
    const fromApp = urlParams.get('fromApp') === 'true';
    const examId = urlParams.get('examId');
    const attemptId = urlParams.get('attemptId');
    const token = urlParams.get('token');
    
    if (fromApp && examId && attemptId && token) {
      console.log('[STUDENT EXAMS] Opened from IMS EXAM PCTU app, loading exam...');
      // Store token if provided
      if (token && token !== localStorage.getItem('token')) {
        localStorage.setItem('token', token);
        console.log('[STUDENT EXAMS] Token stored from URL');
      }
      
      // Load exam data and start exam
      loadExamFromApp(examId, attemptId);
    }

    // Cleanup timer, cheating detection, webcam, and polling on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (readingIntervalRef.current) {
        clearInterval(readingIntervalRef.current);
      }
      stopCheatingDetection();
      stopWebcamRecording();
      stopAutoRefresh();
      document.body.classList.remove('exam-regulation-viewing');
    };
  }, []);

  // Handle ESC key to close warning alert
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && showBacktrackWarning) {
        setShowBacktrackWarning(false);
      }
    };

    if (showBacktrackWarning) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showBacktrackWarning]);

  // Cleanup socket connection on unmount or when exam ends
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Disconnect socket when exam ends
  useEffect(() => {
    if (showResults || !currentAttempt) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }
  }, [showResults, currentAttempt]);

  // Prevent copy/paste during exam
  useEffect(() => {
    if (!currentAttempt) {
      return;
    }

    // Disable text selection
    const style = document.createElement('style');
    style.textContent = `
      .session-main-container {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      .session-main-container input[type="radio"],
      .session-main-container input[type="checkbox"],
      .session-main-container textarea {
        -webkit-user-select: auto !important;
        -moz-user-select: auto !important;
        -ms-user-select: auto !important;
        user-select: auto !important;
      }
    `;
    document.head.appendChild(style);

    // Prevent context menu (right-click)
    const preventContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // Prevent copy/paste keyboard shortcuts
    const preventCopyPaste = (e) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+S
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (['c', 'v', 'x', 'a', 's'].includes(key)) {
          // Allow in textarea and input fields
          const target = e.target;
          if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
            return true;
          }
          e.preventDefault();
          return false;
        }
      }
      // Block F12 (Developer Tools)
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      // Block Print Screen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        return false;
      }
    };

    // Prevent copy events
    const preventCopy = (e) => {
      const target = e.target;
      // Allow copy in textarea and input fields
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        return true;
      }
      e.preventDefault();
      return false;
    };

    // Prevent drag
    const preventDrag = (e) => {
      e.preventDefault();
      return false;
    };

    // Add event listeners
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventCopyPaste);
    document.addEventListener('copy', preventCopy);
    document.addEventListener('cut', preventCopy);
    document.addEventListener('dragstart', preventDrag);
    document.addEventListener('selectstart', (e) => {
      const target = e.target;
      // Allow selection in textarea and input fields
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        return true;
      }
      e.preventDefault();
      return false;
    });

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventCopyPaste);
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('cut', preventCopy);
      document.removeEventListener('dragstart', preventDrag);
      document.head.removeChild(style);
    };
  }, [currentAttempt]);

  // Check if document is in fullscreen mode
  const isFullscreen = () => {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  };

  // Fullscreen functions
  const enterFullscreen = () => {
    try {
      // Only enter fullscreen if not already in fullscreen
      if (isFullscreen()) {
        return;
      }

      const element = document.documentElement;
      if (element.requestFullscreen) {
        element.requestFullscreen().catch(err => {
          console.log('Fullscreen request denied or failed:', err);
        });
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
    } catch (error) {
      console.error('Error entering fullscreen:', error);
    }
  };

  const exitFullscreen = () => {
    try {
      // Only exit fullscreen if currently in fullscreen mode
      if (!isFullscreen()) {
        return;
      }

      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          console.log('Exit fullscreen failed:', err);
        });
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen().catch(err => {
          console.log('Exit fullscreen failed:', err);
        });
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen().catch(err => {
          console.log('Exit fullscreen failed:', err);
        });
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen().catch(err => {
          console.log('Exit fullscreen failed:', err);
        });
      }
    } catch (error) {
      // Silently handle errors - document might not be active or not in fullscreen
      console.log('Exit fullscreen error (ignored):', error.message);
    }
  };

  // Set body class to hide navbar and topheader when taking exam, and manage fullscreen
  useEffect(() => {
    const isTakingExam = currentAttempt && selectedExam && examQuestions.length > 0 && !showResults;
    
    if (isTakingExam) {
      document.body.classList.add('exam-taking');
      // Enter fullscreen when exam starts
      enterFullscreen();
    } else {
      document.body.classList.remove('exam-taking');
      // Exit fullscreen when exam ends
      exitFullscreen();
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('exam-taking');
      exitFullscreen();
    };
  }, [currentAttempt, selectedExam, examQuestions.length, showResults]);

  // Handle click outside and ESC key to cancel submit confirmation
  useEffect(() => {
    if (!showConfirmSubmit) return;

    const handleClickOutside = (event) => {
      if (examActionsRef.current && !examActionsRef.current.contains(event.target)) {
        setShowConfirmSubmit(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setShowConfirmSubmit(false);
      }
    };

    // Add event listeners
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showConfirmSubmit]);

  // Helper function to create hash from exams data for comparison
  const createExamsHash = (examsData) => {
    if (!examsData || !Array.isArray(examsData)) return null;

    // Create a hash based on exam IDs, status, scores, and other important fields
    const hashData = examsData.map(exam => ({
      id: exam.exam_id,
      approved: exam.is_approved,
      best_score: exam.best_score,
      attempts_count: exam.attempts_count,
      time_spent: exam.time_spent_seconds,
      duration_minutes: exam.duration_minutes,
      available_from: exam.available_from,
      available_until: exam.available_until,
      total_points: exam.total_points,
      passing_score: exam.passing_score
    }));

    return JSON.stringify(hashData);
  };

  const fetchExams = async () => {
    try {
      setLoading(true);
      const response = await api.get('/lms/exams/student');

      const examsData = response.data?.data;
      let finalExams = [];

      if (Array.isArray(examsData)) {
        finalExams = examsData;
      } else if (examsData && Array.isArray(examsData.exams)) {
        finalExams = examsData.exams;
      } else {
        finalExams = [];
      }

      setExams(finalExams);
      // Update hash for comparison
      lastExamsHashRef.current = createExamsHash(finalExams);
    } catch (error) {
      console.error('Error fetching exams:', error);
      showAlertMessage(t('studentExams.errors.loadExams'), 'danger');
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  // Load exam when opened from IMS EXAM PCTU app
  const loadExamFromApp = async (examId, attemptId) => {
    try {
      console.log('[LOAD EXAM FROM APP] Loading exam:', { examId, attemptId });
      
      // Fetch exam list directly to get exam data
      const response = await api.get('/lms/exams/student');
      const examsData = response.data?.data;
      let finalExams = [];

      if (Array.isArray(examsData)) {
        finalExams = examsData;
      } else if (examsData && Array.isArray(examsData.exams)) {
        finalExams = examsData.exams;
      } else {
        finalExams = [];
      }
      
      // Update state
      setExams(finalExams);
      
      // Find the exam from fetched list
      const exam = finalExams.find(e => e.exam_id == examId) || finalExams.find(e => e.exam_id === examId);
      if (exam) {
        console.log('[LOAD EXAM FROM APP] Found exam:', exam);
        setSelectedExam(exam);
        
        // Start exam attempt again (it will resume if already started)
        // This will load full exam data including questions
        await proceedWithExamStart(null, exam, attemptId);
      } else {
        // If exam not found in list, show error
        console.error('[LOAD EXAM FROM APP] Exam not found in list. ExamId:', examId, 'Available exams:', finalExams.map(e => e.exam_id));
        showAlertMessage(t('studentExams.errors.examNotFound'), 'danger');
      }
    } catch (error) {
      console.error('[LOAD EXAM FROM APP] Error loading exam:', error);
        showAlertMessage(t('studentExams.errors.loadExam'), 'danger');
    }
  };

  // Silent fetch for auto-refresh (no loading state, no error alerts)
  const fetchExamsSilently = async () => {
    // Don't fetch if user is taking an exam or modal is open
    if (currentAttempt || showStartModal) {
      return;
    }

    try {
      const response = await api.get('/lms/exams/student');

      const examsData = response.data?.data;
      let finalExams = [];

      if (Array.isArray(examsData)) {
        finalExams = examsData;
      } else if (examsData && Array.isArray(examsData.exams)) {
        finalExams = examsData.exams;
      } else {
        finalExams = [];
      }

      // Compare with previous data
      const newHash = createExamsHash(finalExams);
      const oldHash = lastExamsHashRef.current;

      // Only update if data has changed
      if (newHash !== oldHash && newHash !== null) {
        setExams(finalExams);
        lastExamsHashRef.current = newHash;
      }
    } catch (error) {
      // Silent error - don't show alert for background updates
      console.error('Error silently fetching exams:', error);
    }
  };

  // Start auto-refresh polling
  const startAutoRefresh = () => {
    // Don't start if already polling or if user is taking exam
    if (isPollingActiveRef.current || currentAttempt) {
      return;
    }

    isPollingActiveRef.current = true;

    // Poll every 10 seconds (adjustable)
    pollingIntervalRef.current = setInterval(() => {
      if (!currentAttempt && !showStartModal) {
        fetchExamsSilently();
      }
    }, 10000); // 10 seconds
  };

  // Stop auto-refresh polling
  const stopAutoRefresh = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    isPollingActiveRef.current = false;
  };

  const showAlertMessage = (message, variant = 'info') => {
    const titles = {
      success: t('common.success'),
      info: t('common.info', 'Thông tin'),
      warning: t('common.warning', 'Cảnh báo'),
      danger: t('common.error')
    };
    showAlert(message, variant, titles[variant] || t('common.notification', 'Thông báo'));
  };

  const handleStartExam = async (exam) => {
    // Get regulation setting first
    try {
      const regulationResponse = await api.get('/lms/exam-regulation');
      if (regulationResponse.data.success && regulationResponse.data.data) {
        const regulation = regulationResponse.data.data;
        const requireReadEachTime = regulation.require_read_each_time === 1 || regulation.require_read_each_time === true;
        
        // If require_read_each_time is FALSE, skip regulation check and go directly to start modal
        if (!requireReadEachTime) {
          setSelectedExam(exam);
          setShowStartModal(true);
          
          // Load IMS EXAM PCTU file info if required
          if (exam?.ims_exam_pctu_required === true || exam?.ims_exam_pctu_required === 1) {
            fetchImsExamPctuFiles();
          }
          return;
        }
        
        // If require_read_each_time is TRUE, always need to confirm (each time)
        // Check if there's an unconfirmed reading session
        const confirmationResponse = await api.get('/lms/exam-regulation/confirmation');
        if (confirmationResponse.data.success) {
          const confirmationData = confirmationResponse.data.data;
          
          // If there's an active regulation and not confirmed, show regulation modal
          if (confirmationData.hasActiveRegulation && !confirmationData.isConfirmed) {
            // Save exam to pending and show regulation modal
            setPendingExam(exam);
            setExamRegulation(regulation);
            
            // Get or set reading start time
            let startTime = null;
            
            if (confirmationData.readingStartTime) {
              // Use server time (most accurate)
              startTime = new Date(confirmationData.readingStartTime);
              localStorage.setItem(`regulation_reading_start_${regulation.regulation_id}`, confirmationData.readingStartTime);
            } else {
              // No reading session yet, start a new one
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
              document.body.classList.add('exam-regulation-viewing');
            }
            showAlertMessage(t('studentExams.regulation.pleaseConfirmBeforeStart'), 'warning');
            return;
          }
        }
      }
    } catch (error) {
      console.error('Error checking exam regulation:', error);
    }
    
    // If regulation is already confirmed or not required, proceed to start modal
    setSelectedExam(exam);
    setShowStartModal(true);
    
    // Load IMS EXAM PCTU file info if required
    if (exam?.ims_exam_pctu_required === true || exam?.ims_exam_pctu_required === 1) {
      fetchImsExamPctuFiles();
    }
  };
  
  // Fetch IMS EXAM PCTU file information
  const fetchImsExamPctuFiles = async () => {
    setLoadingFiles(true);
    try {
      const response = await api.get('/system/ims-exam-pctu/files');
      if (response.data.success) {
        setImsExamPctuFiles(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching IMS EXAM PCTU files:', error);
      setImsExamPctuFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  // Check face sample status
  const checkFaceSampleStatus = async () => {
    try {
      const response = await api.get('/profile/face-sample/status');
      if (response.data.success) {
        setHasFaceSample(response.data.data.hasFaceSample);
        return response.data.data.hasFaceSample;
      }
      return false;
    } catch (error) {
      console.error('Error checking face sample status:', error);
      return false;
    }
  };

  // Confirm exam regulation
  const handleConfirmRegulation = async () => {
    if (!canConfirm) {
      showAlertMessage(t('studentExams.regulation.needReadTime', { 
        seconds: examRegulation.reading_time_seconds || 30, 
        remaining: (examRegulation.reading_time_seconds || 30) - elapsedSeconds 
      }), 'warning');
      return;
    }

    try {
      const response = await api.post('/lms/exam-regulation/confirm');
      if (response.data.success) {
        // Clear state first
        setReadingStartTime(null);
        setElapsedSeconds(0);
        setCanConfirm(false);
        
        // Clear localStorage
        if (examRegulation) {
          localStorage.removeItem(`regulation_reading_start_${examRegulation.regulation_id}`);
        }
        
        // Check if require_read_each_time is true and there's a pending exam
        const requireReadEachTime = examRegulation.require_read_each_time === 1 || examRegulation.require_read_each_time === true;
        const examToProceed = pendingExam;
        
        // Close regulation modal
        setShowRegulationModal(false);
        document.body.classList.remove('exam-regulation-viewing');
        
        // Clear pending exam
        setPendingExam(null);
        
        showAlertMessage(t('studentExams.regulation.confirmSuccess'), 'success');
        
        // If require_read_each_time is true and there's a pending exam, proceed to start modal
        if (requireReadEachTime && examToProceed) {
          // Small delay to ensure modal is closed before opening new one
          setTimeout(() => {
            setSelectedExam(examToProceed);
            setShowStartModal(true);
            
            // Load IMS EXAM PCTU file info if required
            if (examToProceed?.ims_exam_pctu_required === true || examToProceed?.ims_exam_pctu_required === 1) {
              fetchImsExamPctuFiles();
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error confirming regulation:', error);
      if (error.response?.data?.message) {
        showAlertMessage(error.response.data.message, 'danger');
      } else {
        showAlertMessage(t('studentExams.errors.confirmError'), 'danger');
      }
    }
  };

  // Face verification functions removed - now handled by FaceVerificationModal component

  // Open face verification modal
  const openFaceVerificationModal = async () => {
    setShowFaceVerificationModal(true);
  };

  // Handle face verification success (callback for FaceVerificationModal)
  const handleFaceVerificationSuccess = async (finalImage, metadata) => {
    try {
      // Refresh CSRF token before making the request
      await refreshCSRFToken();

      const verifyResponse = await api.post(`/lms/exams/${selectedExam.exam_id}/verify-face`, {
        faceImage: finalImage
      });

      if (!verifyResponse.data.success || !verifyResponse.data.verified) {
        // Face verification failed
        return false;
      }

      // Face verification passed - create verification result object
      const verificationResult = {
        verified: true,
        similarity: verifyResponse.data.similarity,
        threshold: verifyResponse.data.threshold
      };

      // Set state immediately
      setFaceVerificationResult(verificationResult);

      // Close modal after 1 second and proceed to start exam
      setTimeout(() => {
        setShowFaceVerificationModal(false);
        proceedWithExamStart(verificationResult);
      }, 1000);

      return verificationResult;
    } catch (error) {
      console.error('Error in face verification:', error);
      return false;
    }
  };

  // Face verification functions and effects removed - now handled by FaceVerificationModal component

  // Check if IMS EXAM PCTU is running (with retry logic)
  // Function to detect if Developer Tools is open
  const detectDeveloperTools = () => {
    let devToolsOpen = false;
    
    // Method 1: Check window dimensions (most reliable)
    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    
    if (widthThreshold || heightThreshold) {
      devToolsOpen = true;
    }
    
    // Method 2: Check console detection (Chrome/Edge)
    try {
      const element = new Image();
      Object.defineProperty(element, 'id', {
        get: function() {
          devToolsOpen = true;
        }
      });
      console.log('%c', element);
      console.clear(); // Clear the detection log
    } catch (e) {
      // Ignore errors
    }
    
    // Method 3: Check debugger (if DevTools is open, debugger will pause)
    // We use setTimeout to avoid blocking
    try {
      const start = performance.now();
      debugger; // eslint-disable-line no-debugger
      const end = performance.now();
      // If DevTools is open, debugger might cause a slight delay
      if (end - start > 100) {
        devToolsOpen = true;
      }
    } catch (e) {
      // Ignore errors
    }
    
    return devToolsOpen;
  };
  
  const checkIMSExamPCTURunning = async (retries = 3, delay = 500) => {
    console.log(`[IMS EXAM PCTU CHECK] Starting health check (retries: ${retries}, delay: ${delay}ms)...`);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      console.log(`[IMS EXAM PCTU CHECK] Attempt ${attempt}/${retries}...`);
      
      try {
        // IMS EXAM PCTU runs a local HTTP server on port 8765
        // Use a timeout to avoid hanging if server is not running
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log(`[IMS EXAM PCTU CHECK] Attempt ${attempt}: Timeout reached, aborting request...`);
          controller.abort();
        }, 2000); // 2 seconds timeout per attempt

        try {
          console.log(`[IMS EXAM PCTU CHECK] Attempt ${attempt}: Sending fetch request to http://localhost:8765/health`);
          const response = await fetch('http://localhost:8765/health', {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-cache',
            mode: 'cors' // Explicitly allow CORS
          });
          clearTimeout(timeoutId);
          
          console.log(`[IMS EXAM PCTU CHECK] Attempt ${attempt}: Response received:`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
          });
          
          if (!response.ok) {
            console.warn(`[IMS EXAM PCTU CHECK] Attempt ${attempt}: HTTP error:`, response.status, response.statusText);
            if (attempt < retries) {
              console.log(`[IMS EXAM PCTU CHECK] Attempt ${attempt}: Retrying after ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            return false;
          }
          
          // Check response body
          console.log(`[IMS EXAM PCTU CHECK] Attempt ${attempt}: Parsing response body...`);
          const data = await response.json();
          console.log(`[IMS EXAM PCTU CHECK] Attempt ${attempt}: Response data:`, JSON.stringify(data, null, 2));
          console.log(`[IMS EXAM PCTU CHECK] Attempt ${attempt}: Checking conditions:`, {
            hasData: !!data,
            hasSuccess: data?.success !== undefined,
            successValue: data?.success,
            hasName: data?.name !== undefined,
            nameValue: data?.name,
            hasStatus: data?.status !== undefined,
            statusValue: data?.status,
            condition1: data?.success === true,
            condition2: data?.name === 'IMS EXAM PCTU' && data?.status === 'running'
          });
          
          // Only accept IMS EXAM PCTU response:
          // 1. Must have success: true OR
          // 2. Must have name: 'IMS EXAM PCTU' AND status: 'running' OR
          // 3. Must have status: 'running' AND platform: 'win32'/'darwin'/'linux' (fallback for compatibility)
          // This prevents false positives from other services on port 8765
          const isValidResponse = data && (
            data.success === true || 
            (data.name === 'IMS EXAM PCTU' && data.status === 'running') ||
            (data.status === 'running' && data.platform && ['win32', 'darwin', 'linux'].includes(data.platform) && data.version)
          );
          
          if (isValidResponse) {
            console.log(`[IMS EXAM PCTU CHECK] ✅ Attempt ${attempt}: Health check PASSED:`, {
              name: data.name || 'IMS EXAM PCTU',
              version: data.version || 'unknown',
              status: data.status || 'unknown'
            });
            return true;
          }
          
          console.warn(`[IMS EXAM PCTU CHECK] ❌ Attempt ${attempt}: Health check FAILED - invalid response format or not IMS EXAM PCTU:`, data);
          if (attempt < retries) {
            console.log(`[IMS EXAM PCTU CHECK] Attempt ${attempt}: Retrying after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          return false;
        } catch (error) {
          clearTimeout(timeoutId);
          console.error(`[IMS EXAM PCTU CHECK] ❌ Attempt ${attempt}: Fetch error:`, {
            name: error.name,
            message: error.message
          });
          if (error.name === 'AbortError') {
            // Timeout - server not responding
            console.warn(`[IMS EXAM PCTU CHECK] ❌ Attempt ${attempt}: Request timeout - server not responding`);
            if (attempt < retries) {
              console.log(`[IMS EXAM PCTU CHECK] Attempt ${attempt}: Retrying after ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            return false;
          }
          // Other errors (network, CORS, etc.)
          console.warn(`[IMS EXAM PCTU CHECK] ❌ Attempt ${attempt}: Network/CORS error:`, error.message);
          if (attempt < retries) {
            console.log(`[IMS EXAM PCTU CHECK] Attempt ${attempt}: Retrying after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          return false;
        }
      } catch (error) {
        console.error(`[IMS EXAM PCTU CHECK] ❌ Attempt ${attempt}: Outer exception:`, {
          name: error.name,
          message: error.message
        });
        if (attempt < retries) {
          console.log(`[IMS EXAM PCTU CHECK] Attempt ${attempt}: Retrying after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return false;
      }
    }
    
    console.warn('[IMS EXAM PCTU CHECK] ❌ All attempts failed');
    return false;
  };

  // Confirm start exam (check face verification if required)
  const confirmStartExam = async () => {
    try {
      // Stop auto-refresh when starting exam
      stopAutoRefresh();

      // Reset password error
      setPasswordError('');

      // Check if Developer Tools is open
      console.log('[EXAM START] Checking for Developer Tools...');
      if (detectDeveloperTools()) {
        console.warn('[EXAM START] ❌ Developer Tools is open, blocking exam start');
        showAlert(t('studentExams.errors.devToolsOpen'), 'danger');
        return;
      }
      console.log('[EXAM START] ✅ Developer Tools check passed');

      // Check if IMS EXAM PCTU is required
      if (selectedExam?.ims_exam_pctu_required === true || selectedExam?.ims_exam_pctu_required === 1) {
        const isRunning = await checkIMSExamPCTURunning();
        if (!isRunning) {
          showAlert(t('studentExams.errors.imsExamPctuRequired'), 'warning');
          return;
        }
      }

      // Check if webcam is required
      if (selectedExam?.webcam_required === true || selectedExam?.webcam_required === 1) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false
          });
          // Stop the stream immediately, we'll start it again after exam starts
          stream.getTracks().forEach(track => track.stop());
          setWebcamModalError(''); // Clear webcam error if successful
        } catch (error) {
          setWebcamModalError(t('studentExams.errors.webcamError'));
          return; // Don't proceed if webcam is denied
        }
      }

      // Check if face verification is required
      if (selectedExam?.face_verification_enabled) {
        // First, check if user is exempt from face verification
        try {
          const statusResponse = await api.get(`/lms/exams/${selectedExam.exam_id}/face-verification-status`);

          if (statusResponse.data.success) {
            // If user is exempt, skip face verification
            if (statusResponse.data.exempt) {
              console.log('User is exempt from face verification, proceeding directly');
              // Set exempt status for proceedWithExamStart
              const exemptResult = {
                exempt: true,
                verified: false
              };
              setFaceVerificationResult(exemptResult);
              await proceedWithExamStart(exemptResult);
              return;
            }

            // If user doesn't have face sample, show modal
            if (!statusResponse.data.hasFaceSample) {
              setShowFaceSampleRequiredModal(true);
              return;
            }

            // User is not exempt and has face sample - proceed with face verification
            // Open face verification modal
            await openFaceVerificationModal();
            return; // Don't proceed until face verification is complete
          }
        } catch (statusError) {
          console.error('Error checking face verification status:', statusError);
          // Fallback to old behavior if status check fails
          const hasSample = await checkFaceSampleStatus();
          if (hasSample === false) {
            setShowFaceSampleRequiredModal(true);
            return;
          }
          await openFaceVerificationModal();
          return;
        }
      }

      // If no face verification required, proceed directly
      await proceedWithExamStart(null);
    } catch (error) {
      console.error('Error in confirmStartExam:', error);

      if (error.response?.data?.requires_password) {
        setRequiresPassword(true);
        setPasswordError(error.response?.data?.message || t('studentExams.errors.passwordIncorrect'));
        return;
      }

      if (error.response?.data?.requires_ims_exam_pctu) {
        showAlert(error.response?.data?.message || t('studentExams.errors.imsExamPctuRequired'), 'warning');
        return;
      }

      if (error.response?.data?.faceVerificationRequired) {
        // Face verification is required but not completed
        return;
      }

      showAlertMessage(error.response?.data?.message || t('studentExams.errors.cannotStart'), 'danger');
      setShowStartModal(false);
    }
  };

  // Proceed with exam start after face verification
  const proceedWithExamStart = async (passedVerificationResult = null, examOverride = null, attemptIdOverride = null) => {
    try {
      await refreshCSRFToken();

      // Use override exam if provided (for loading from app), otherwise use selectedExam
      const examToUse = examOverride || selectedExam;
      
      // If attemptIdOverride is provided, we're resuming an existing attempt
      // But we still need to call the API to get full attempt data
      if (attemptIdOverride && examToUse) {
        console.log('[EXAM START] Resuming existing attempt from app:', attemptIdOverride);
        // Still call start exam endpoint - it will resume the attempt and return full data
        // Skip IMS EXAM PCTU and safety checks since we're already in the app
        // Skip face verification since it was already done
        // Skip password since it was already entered
        try {
          const resumeResponse = await api.post(`/lms/exams/${examToUse.exam_id}/attempts`, {
            password: examPassword || null,
            faceVerificationStatus: 'verified', // Assume verified since we're resuming
            ims_exam_pctu_running: true // Assume running since we're in the app
          });
          
          if (resumeResponse.data.success) {
            const attemptData = resumeResponse.data.data;
            // Continue with normal exam loading flow below
            // This will set up the exam state, questions, answers, timer, etc.
            // We'll handle this after the IMS EXAM PCTU check section
            console.log('[EXAM START] Successfully resumed attempt:', attemptData);
            
            // Set exam state
            setSelectedExam(examToUse);
            setCurrentAttempt(attemptData);
            attemptIdRef.current = attemptData.attempt_id;
            setShowStartModal(false);
            setExamPassword('');
            setPasswordError('');
            setRequiresPassword(false);

            // Update selectedExam with data from attemptData if available
            if (attemptData.exam) {
              setSelectedExam(prev => ({
                ...prev,
                ...attemptData.exam
              }));
            }

            // Set questions per page from exam settings
            const qpp = attemptData.exam?.questions_per_page || 'all';
            setQuestionsPerPage(qpp);
            
            // Set current page - use saved page if resuming, otherwise start at page 1
            if (attemptData.isResumed && attemptData.currentPage) {
              setCurrentPage(attemptData.currentPage);
              console.log(`📄 Resuming at page ${attemptData.currentPage}`);
            } else {
              setCurrentPage(1);
            }

            // Use questions from startExamAttempt response
            if (attemptData.questions && Array.isArray(attemptData.questions)) {
              setExamQuestions(attemptData.questions);

              // Initialize answers - use saved answers if resuming
              const initialAnswers = {};
              const initialTimestamps = {};
              
              if (attemptData.isResumed && attemptData.savedAnswers) {
                console.log('🔄 Resuming exam - savedAnswers:', attemptData.savedAnswers);
                console.log('🔄 Resuming exam - savedAnswerTimestamps:', attemptData.savedAnswerTimestamps);
                
                attemptData.questions.forEach(q => {
                  const savedAnswer = attemptData.savedAnswers[q.question_id];
                  
                  if (savedAnswer !== undefined && savedAnswer !== null) {
                    if (q.question_type === 'mcq' || q.question_type === 'multiple_choice') {
                      initialAnswers[q.question_id] = Array.isArray(savedAnswer) ? (savedAnswer.length > 0 ? savedAnswer[0] : '') : savedAnswer;
                    } else if (q.question_type === 'multiple_response') {
                      initialAnswers[q.question_id] = Array.isArray(savedAnswer) ? savedAnswer : [savedAnswer];
                    } else if (q.question_type === 'true_false') {
                      if (typeof savedAnswer === 'boolean') {
                        initialAnswers[q.question_id] = savedAnswer;
                      } else if (savedAnswer === 'true' || savedAnswer === true || savedAnswer === 1) {
                        initialAnswers[q.question_id] = true;
                      } else if (savedAnswer === 'false' || savedAnswer === false || savedAnswer === 0) {
                        initialAnswers[q.question_id] = false;
                      } else {
                        initialAnswers[q.question_id] = null;
                      }
                    } else {
                      initialAnswers[q.question_id] = savedAnswer;
                    }
                  } else {
                    if (q.question_type === 'mcq' || q.question_type === 'multiple_choice') {
                      initialAnswers[q.question_id] = '';
                    } else if (q.question_type === 'multiple_response') {
                      initialAnswers[q.question_id] = [];
                    } else if (q.question_type === 'true_false') {
                      initialAnswers[q.question_id] = null;
                    } else {
                      initialAnswers[q.question_id] = '';
                    }
                  }
                });
                
                if (attemptData.savedAnswerTimestamps) {
                  Object.assign(initialTimestamps, attemptData.savedAnswerTimestamps);
                }
                
                showAlertMessage(t('studentExams.success.resumed'), 'info');
              } else {
                attemptData.questions.forEach(q => {
                  if (q.question_type === 'mcq' || q.question_type === 'multiple_choice') {
                    initialAnswers[q.question_id] = '';
                  } else if (q.question_type === 'multiple_response') {
                    initialAnswers[q.question_id] = [];
                  } else if (q.question_type === 'true_false') {
                    initialAnswers[q.question_id] = null;
                  } else {
                    initialAnswers[q.question_id] = '';
                  }
                });
              }
              
              setAnswers(initialAnswers);
              setAnswerTimestamps(initialTimestamps);
              answersRef.current = initialAnswers;
              answerTimestampsRef.current = initialTimestamps;
            }

            // Set timer
            if (attemptData.isResumed && attemptData.timeRemaining !== null && attemptData.timeRemaining !== undefined) {
              setTimeRemaining(attemptData.timeRemaining);
              timeRemainingRef.current = attemptData.timeRemaining;
            } else {
              const duration = attemptData.time_limit_minutes || attemptData.exam?.duration_minutes || examToUse.duration_minutes;
              if (duration) {
                const initialTime = duration * 60;
                setTimeRemaining(initialTime);
                timeRemainingRef.current = initialTime;
              }
            }

            // Start timer
            startTimer();

            // Start webcam if required
            const examWebcamRequired = (examToUse?.webcam_required === true || examToUse?.webcam_required === 1) || 
                                     ((!examToUse || examToUse.webcam_required === undefined) && 
                                      (attemptData.exam?.webcam_required === true || attemptData.exam?.webcam_required === 1));
            if (examWebcamRequired) {
              try {
                startWebcamRecording(attemptData.attempt_id);
              } catch (error) {
                if (examToUse?.webcam_required === false) {
                  console.warn('Webcam start failed but user is exempt, continuing exam:', error);
                } else {
                  throw error;
                }
              }
            }

            // Start cheating detection
            startCheatingDetection(attemptData);

            // Connect to socket.io
            if (attemptData.attempt_id) {
              const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000');
              socketRef.current = socket;
              socket.emit('exam:join_attempt', attemptData.attempt_id);
              socket.on('exam:banned', () => {
                showAlertMessage(t('studentExams.success.banned'), 'danger');
                submitExamWithId(attemptData.attempt_id);
              });
            }
            
            return; // Exit early since we've loaded the exam
          } else {
            console.error('[EXAM START] Failed to resume attempt:', resumeResponse.data);
            showAlert(t('studentExams.errors.cannotResume'), 'danger');
            return;
          }
        } catch (resumeError) {
          console.error('[EXAM START] Error resuming attempt:', resumeError);
          showAlert(t('studentExams.errors.errorResume'), 'danger');
          return;
        }
      }
      
      // If no exam to use, show error
      if (!examToUse) {
        console.error('[EXAM START] No exam selected');
        showAlert(t('studentExams.errors.examNotFound'), 'danger');
        return;
      }

      // Use passed result or fallback to state
      const verificationResult = passedVerificationResult || faceVerificationResult;

      // Determine face verification status
      let faceVerificationStatus = 'not_required';
      if (examToUse?.face_verification_enabled) {
        if (verificationResult?.exempt) {
          faceVerificationStatus = 'exempt';
        } else if (verificationResult?.verified) {
          faceVerificationStatus = 'verified';
        } else {
          faceVerificationStatus = 'pending';
        }
      }

      // Check if IMS EXAM PCTU is required and running
      let imsExamPCTURunning = false;
      if (examToUse?.ims_exam_pctu_required === true || examToUse?.ims_exam_pctu_required === 1) {
        console.log('[EXAM START] IMS EXAM PCTU is required, checking if running...');
        imsExamPCTURunning = await checkIMSExamPCTURunning();
        console.log('[EXAM START] IMS EXAM PCTU check result:', imsExamPCTURunning);
        
        if (!imsExamPCTURunning) {
          console.warn('[EXAM START] ❌ IMS EXAM PCTU not running, blocking exam start');
          showAlert(t('studentExams.errors.imsExamPctuRequired'), 'warning');
          return;
        }
        
        // Perform safety check before starting exam
        console.log('[EXAM START] Performing safety check...');
        try {
          const safetyResponse = await fetch('http://localhost:8765/safety-status', {
            method: 'GET',
            cache: 'no-cache',
            mode: 'cors'
          });
          
          if (safetyResponse.ok) {
            const safetyData = await safetyResponse.json();
            console.log('[EXAM START] Safety check result:', safetyData);
            
            if (!safetyData.safe && safetyData.issues && safetyData.issues.length > 0) {
              // Build error message from issues
              const errorMessages = safetyData.issues.map(issue => 
                `${issue.title}: ${issue.description}\n${t('common.action', 'Hành động')}: ${issue.action}`
              ).join('\n\n');
              
              console.warn('[EXAM START] ❌ Safety check failed:', safetyData.issues);
              showAlert(
                t('studentExams.warnings.safetyIssues', { issues: errorMessages }),
                'danger'
              );
              return; // Block exam start
            }
            
            console.log('[EXAM START] ✅ Safety check passed');
          } else {
            console.warn('[EXAM START] ⚠️ Safety check endpoint returned error:', safetyResponse.status);
            // If can't check, block exam start for safety
            showAlert(
              t('studentExams.warnings.cannotCheckSafety'),
              'warning'
            );
            return;
          }
        } catch (error) {
          console.warn('[EXAM START] ⚠️ Error performing safety check:', error);
          // If can't check, block exam start for safety
          showAlert(
            t('studentExams.warnings.cannotCheckSafety'),
            'warning'
          );
          return;
        }
        
        // Trigger system lock in IMS EXAM PCTU app and load keyboard blocking script
        console.log('[EXAM START] Activating system lock in IMS EXAM PCTU...');
        try {
          const lockResponse = await fetch('http://localhost:8765/start-exam', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
          });
          console.log('[EXAM START] System lock activation response:', {
            status: lockResponse.status,
            ok: lockResponse.ok
          });
          const lockData = await lockResponse.json();
          console.log('[EXAM START] System lock activation data:', lockData);
          
          // Load and inject keyboard blocking script
          try {
            const scriptResponse = await fetch('http://localhost:8765/keyboard-block-script');
            if (scriptResponse.ok) {
              const scriptCode = await scriptResponse.text();
              
              // Create script element and inject it
              const scriptElement = document.createElement('script');
              scriptElement.id = 'ims-exam-pctu-keyboard-block';
              scriptElement.textContent = scriptCode;
              
              // Remove existing script if any
              const existingScript = document.getElementById('ims-exam-pctu-keyboard-block');
              if (existingScript) {
                existingScript.remove();
              }
              
              // Inject script into document
              (document.head || document.documentElement).appendChild(scriptElement);
              
              // Store cleanup function reference if available
              try {
                // The script returns a cleanup function, try to capture it
                const scriptResult = eval(scriptCode); // eslint-disable-line no-eval
                if (typeof scriptResult === 'function') {
                  window.imsExamPCTUCleanup = scriptResult;
                }
              } catch (e) {
                // Script is IIFE, cleanup function not directly accessible
                // Will be handled when removing script element
                console.debug('Script cleanup function not accessible (this is normal for IIFE)');
              }
              
              console.log('[EXAM START] ✅ Keyboard blocking script loaded and injected');
            } else {
              console.warn('[EXAM START] ⚠️ Could not load keyboard blocking script:', scriptResponse.status);
            }
          } catch (scriptError) {
            console.warn('[EXAM START] ⚠️ Error loading keyboard blocking script:', scriptError);
            // Continue anyway - keyboard blocking is not critical
          }
        } catch (error) {
          console.error('[EXAM START] ❌ Error activating system lock in IMS EXAM PCTU:', error);
          // Continue anyway - the app might still be running
        }
      } else {
        console.log('[EXAM START] IMS EXAM PCTU is not required for this exam');
      }

      const response = await api.post(`/lms/exams/${examToUse.exam_id}/attempts`, {
        password: examPassword || null,
        faceVerificationStatus: faceVerificationStatus,
        faceVerificationData: verificationResult,
        ims_exam_pctu_running: imsExamPCTURunning
      });

      if (response.data.success) {
        const attemptData = response.data.data;
        const attemptId = attemptData?.attempt_id || null;
        
        // If IMS EXAM PCTU is required, open exam in app instead of browser
        if (examToUse?.ims_exam_pctu_required === true || examToUse?.ims_exam_pctu_required === 1) {
          console.log('[EXAM START] IMS EXAM PCTU required - opening exam in app...');
          
          try {
            // Get auth token
            const token = localStorage.getItem('token');
            const serverUrl = window.location.origin;
            
            // Call IMS EXAM PCTU app to open exam window
            const openExamResponse = await fetch('http://localhost:8765/open-exam', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                examId: examToUse.exam_id,
                attemptId: attemptId,
                token: token,
                serverUrl: serverUrl
              })
            });
            
            if (openExamResponse.ok) {
              const openExamData = await openExamResponse.json();
              console.log('[EXAM START] Exam opened in IMS EXAM PCTU app:', openExamData);
              
              // Show success message
              showAlert(t('studentExams.success.examOpenedInApp'), 'success');
              
              // Try to focus on the exam window (if possible)
              // Note: Browser cannot directly focus on desktop app window,
              // but the Electron app will handle focusing when window is created
              // Give a small delay for window to be created
              setTimeout(() => {
                // Try to trigger focus via IPC if available (not possible from browser)
                // The Electron app will handle focus automatically when window is created
                console.log('[EXAM START] Exam window should be focused by IMS EXAM PCTU app');
              }, 500);
              
              // Close modal
              setShowStartModal(false);
              setExamPassword('');
              setPasswordError('');
              setRequiresPassword(false);
              
              // Don't set exam state here - exam will run in app
              return;
            } else {
              console.error('[EXAM START] Failed to open exam in app:', openExamResponse.status);
              showAlert(t('studentExams.errors.cannotOpenInApp'), 'danger');
              return;
            }
          } catch (error) {
            console.error('[EXAM START] Error opening exam in app:', error);
            showAlert(t('studentExams.errors.errorOpenInApp'), 'danger');
            return;
          }
        }
        
        // If IMS EXAM PCTU is not required, proceed with normal browser exam
        // Set selectedExam if not already set
        if (!selectedExam && examToUse) {
          setSelectedExam(examToUse);
        }
        setCurrentAttempt(attemptData);
        // Store attempt_id in ref for timer callback
        attemptIdRef.current = attemptId;
        setShowStartModal(false);
        setExamPassword(''); // Clear password after successful start
        setPasswordError('');
        setRequiresPassword(false);

        // Update selectedExam with data from attemptData if available
        if (attemptData.exam) {
          setSelectedExam(prev => ({
            ...prev,
            ...attemptData.exam
          }));
        }

        // Set questions per page from exam settings
        const qpp = attemptData.exam?.questions_per_page || 'all';
        setQuestionsPerPage(qpp);
        
        // Set current page - use saved page if resuming, otherwise start at page 1
        if (attemptData.isResumed && attemptData.currentPage) {
          setCurrentPage(attemptData.currentPage);
          console.log(`📄 Resuming at page ${attemptData.currentPage}`);
        } else {
          setCurrentPage(1); // Reset to first page for new attempt
        }

        // Use questions from startExamAttempt response (already includes options)
        if (attemptData.questions && Array.isArray(attemptData.questions)) {
          setExamQuestions(attemptData.questions);

          // Initialize answers - use saved answers if resuming, otherwise initialize empty
          const initialAnswers = {};
          const initialTimestamps = {};
          
          if (attemptData.isResumed && attemptData.savedAnswers) {
            // Resume: Load saved answers
            console.log('🔄 Resuming exam - savedAnswers:', attemptData.savedAnswers);
            console.log('🔄 Resuming exam - savedAnswerTimestamps:', attemptData.savedAnswerTimestamps);
            
            attemptData.questions.forEach(q => {
              const savedAnswer = attemptData.savedAnswers[q.question_id];
              
              if (savedAnswer !== undefined && savedAnswer !== null) {
                // Handle different answer formats
                if (q.question_type === 'mcq' || q.question_type === 'multiple_choice') {
                  // For MCQ, savedAnswer might be array [option_id] or single option_id
                  if (Array.isArray(savedAnswer)) {
                    initialAnswers[q.question_id] = savedAnswer.length > 0 ? savedAnswer[0] : '';
                  } else {
                    initialAnswers[q.question_id] = savedAnswer;
                  }
                } else if (q.question_type === 'multiple_response') {
                  // For multiple response, ensure it's an array
                  initialAnswers[q.question_id] = Array.isArray(savedAnswer) ? savedAnswer : [savedAnswer];
                } else if (q.question_type === 'true_false') {
                  // For true/false, can be boolean or string
                  if (typeof savedAnswer === 'boolean') {
                    initialAnswers[q.question_id] = savedAnswer;
                  } else if (savedAnswer === 'true' || savedAnswer === true || savedAnswer === 1) {
                    initialAnswers[q.question_id] = true;
                  } else if (savedAnswer === 'false' || savedAnswer === false || savedAnswer === 0) {
                    initialAnswers[q.question_id] = false;
                  } else {
                    initialAnswers[q.question_id] = null;
                  }
                } else {
                  // For essay/short_answer, use as is
                  initialAnswers[q.question_id] = savedAnswer;
                }
                
                console.log(`✅ Loaded saved answer for question ${q.question_id}:`, initialAnswers[q.question_id]);
              } else {
                // Initialize empty if no saved answer
                if (q.question_type === 'mcq' || q.question_type === 'multiple_choice') {
                  initialAnswers[q.question_id] = '';
                } else if (q.question_type === 'multiple_response') {
                  initialAnswers[q.question_id] = [];
                } else if (q.question_type === 'true_false') {
                  initialAnswers[q.question_id] = null;
                } else {
                  initialAnswers[q.question_id] = '';
                }
              }
            });
            
            // Load saved timestamps
            if (attemptData.savedAnswerTimestamps) {
              Object.assign(initialTimestamps, attemptData.savedAnswerTimestamps);
            }
            
            // Show message that exam was resumed
            showAlertMessage('Đã tiếp tục bài làm. Các đáp án đã chọn trước đó đã được khôi phục.', 'info');
          } else {
            // New attempt: Initialize empty answers
            attemptData.questions.forEach(q => {
              if (q.question_type === 'mcq' || q.question_type === 'multiple_choice') {
                initialAnswers[q.question_id] = '';
              } else if (q.question_type === 'multiple_response') {
                initialAnswers[q.question_id] = [];
              } else if (q.question_type === 'true_false') {
                initialAnswers[q.question_id] = null;
              } else {
                initialAnswers[q.question_id] = '';
              }
            });
          }
          
          setAnswers(initialAnswers);
          setAnswerTimestamps(initialTimestamps);
          // Update refs
          answersRef.current = initialAnswers;
          answerTimestampsRef.current = initialTimestamps;
        } else {
          console.error('No questions found in attempt data:', attemptData);
          showAlertMessage(t('studentExams.errors.noQuestions'), 'danger');
        }

        // Set timer - use timeRemaining if resuming, otherwise calculate from duration
        if (attemptData.isResumed && attemptData.timeRemaining !== null && attemptData.timeRemaining !== undefined) {
          setTimeRemaining(attemptData.timeRemaining);
          timeRemainingRef.current = attemptData.timeRemaining; // Update ref
        } else {
          const duration = attemptData.time_limit_minutes || attemptData.exam?.duration_minutes || selectedExam.duration_minutes;
          if (duration) {
            const initialTime = duration * 60;
            setTimeRemaining(initialTime);
            timeRemainingRef.current = initialTime; // Update ref
          }
        }

        // Start timer
        startTimer();

        // Start webcam if required (use selectedExam first as it has exemption-adjusted values)
        const examWebcamRequired = (selectedExam?.webcam_required === true || selectedExam?.webcam_required === 1) || 
                                   ((!selectedExam || selectedExam.webcam_required === undefined) && 
                                    (attemptData.exam?.webcam_required === true || attemptData.exam?.webcam_required === 1));
        if (examWebcamRequired) {
          try {
            startWebcamRecording(attemptData.attempt_id);
          } catch (error) {
            // If webcam fails but user is exempt, don't block exam
            if (selectedExam?.webcam_required === false) {
              console.warn('Webcam start failed but user is exempt, continuing exam:', error);
            } else {
              throw error; // Re-throw if not exempt
            }
          }
        }

        // Start cheating detection tracking - Pass attemptData directly since state update is async
        startCheatingDetection(attemptData);

        // Connect to socket.io and join attempt room for ban events
        if (attemptData.attempt_id) {
          const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000');
          socketRef.current = socket;

          // Join attempt room
          socket.emit('exam:join_attempt', attemptData.attempt_id);

          // Listen for ban event
          socket.on('exam:banned', (data) => {
            console.log('🚫 Received ban event:', data);
            showAlertMessage(t('studentExams.success.bannedMessage'), 'danger');
            
            // Stop timer
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }

            // Stop webcam recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
            if (webcamStream) {
              webcamStream.getTracks().forEach(track => track.stop());
            }

            // Redirect to exams list after a short delay
            setTimeout(() => {
              navigate('/lms/exams/student');
            }, 2000);
          });

          // Clean up on disconnect
          socket.on('disconnect', () => {
            console.log('Socket disconnected');
          });
        }
      }
    } catch (error) {
      console.error('Error starting exam:', error);

      // Check if password is required
      if (error.response?.data?.requires_password) {
        setRequiresPassword(true);
        setPasswordError(error.response?.data?.message || t('studentExams.errors.passwordIncorrect'));
        return; // Don't close modal, show password error
      }

      // Check if resume permission is required
      if (error.response?.data?.requires_resume_permission) {
        showAlertMessage(
          error.response?.data?.message || 
          t('studentExams.errors.resumePermissionRequired'),
          'warning'
        );
        setShowStartModal(false);
        return;
      }

      showAlertMessage(error.response?.data?.message || t('studentExams.errors.cannotStart'), 'danger');
      setShowStartModal(false); // Close modal on other errors
    }
  };

  const startWebcamRecording = async (attemptId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false
      });

      setWebcamStream(stream);
      setWebcamError(null);

      // Display video
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Start recording
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
          // Upload chunk to server
          uploadVideoChunk(attemptId, event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Upload final video
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          await uploadFinalVideo(attemptId, blob);
        }
      };

      // Start recording and create chunks every 10 seconds
      mediaRecorder.start();
      setIsWebcamRecording(true);

      // Create chunks every 10 seconds
      chunkIntervalRef.current = setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.requestData();
        }
      }, 10000);

    } catch (error) {
      console.error('Error starting webcam:', error);
      // If user is exempt from webcam, don't show error
      if (selectedExam?.webcam_required === false) {
        console.warn('Webcam start failed but user is exempt, continuing without webcam');
        setWebcamError(null);
        setIsWebcamRecording(false);
        return; // Don't block exam
      }
      setWebcamError(t('studentExams.errors.webcamError'));
      showAlertMessage(t('studentExams.errors.webcamStartError'), 'danger');
    }
  };

  const uploadVideoChunk = async (attemptId, chunk) => {
    try {
      const formData = new FormData();
      formData.append('chunk', chunk, `chunk_${Date.now()}.webm`);
      formData.append('attempt_id', attemptId);
      formData.append('chunk_index', chunksRef.current.length - 1);
      formData.append('total_chunks', '0'); // We don't know total chunks in advance

      await api.post(`/lms/attempts/${attemptId}/webcam-chunk`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    } catch (error) {
      console.error('Error uploading video chunk:', error);
    }
  };

  const uploadFinalVideo = async (attemptId, blob) => {
    try {
      const formData = new FormData();
      formData.append('video', blob, `video_${attemptId}.webm`);
      formData.append('attempt_id', attemptId);

      await api.post(`/lms/attempts/${attemptId}/webcam-final`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    } catch (error) {
      console.error('Error uploading final video:', error);
    }
  };

  const stopWebcamRecording = () => {
    // Clear chunk interval
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Stop webcam stream
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }

    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsWebcamRecording(false);
  };

  const startTimer = () => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Track last update time for time_remaining_seconds
    let lastUpdateTime = Date.now();
    const UPDATE_INTERVAL = 5000; // Update every 5 seconds (more frequent to preserve time on crash)

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          timerRef.current = null;
          timeRemainingRef.current = 0; // Update ref
          // Auto-submit when time runs out
          // Use setTimeout to ensure state is updated and avoid race conditions
          setTimeout(() => {
            // Use ref to get latest attempt_id
            const attemptId = attemptIdRef.current;
            if (attemptId) {
              handleAutoSubmitWithId(attemptId);
            } else {
              console.error('Cannot auto-submit: attempt_id is null');
            }
          }, 100);
          return 0;
        }
        
        const newTime = prev - 1;
        timeRemainingRef.current = newTime; // Update ref with latest value
        
        // Update time_remaining_seconds in database every 5 seconds
        // This ensures time is saved frequently enough to preserve it if crash occurs
        const now = Date.now();
        if (now - lastUpdateTime >= UPDATE_INTERVAL) {
          lastUpdateTime = now;
          const attemptId = attemptIdRef.current;
          if (attemptId) {
            // Check safety status if IMS EXAM PCTU is required (every update interval)
            const examId = selectedExam?.id;
            if (examId && (selectedExam?.ims_exam_pctu_required === true || selectedExam?.ims_exam_pctu_required === 1)) {
              // Check safety status in background (don't block time update)
              // Use a flag to prevent multiple simultaneous checks
              if (!window.safetyCheckInProgress) {
                window.safetyCheckInProgress = true;
                
                // Create AbortController for timeout
                const abortController = new AbortController();
                let timeoutId = setTimeout(() => abortController.abort(), 3000);
                
                fetch('http://localhost:8765/safety-status', {
                  method: 'GET',
                  cache: 'no-cache',
                  mode: 'cors',
                  signal: abortController.signal
                })
                .then(safetyResponse => {
                  if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                  }
                  if (safetyResponse.ok) {
                    return safetyResponse.json();
                  }
                  return null;
                })
                .then(safetyData => {
                  if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                  }
                  window.safetyCheckInProgress = false;
                  
                  if (safetyData && !safetyData.safe && safetyData.issues && safetyData.issues.length > 0) {
                    console.warn('[EXAM SAFETY CHECK] ❌ Unsafe conditions detected during exam:', safetyData.issues);
                    
                    // Set flag to prevent other checks from triggering
                    window.examKickedOutDueToSafety = true;
                    
                    // Build error message
                    const errorMessages = safetyData.issues.map(issue => 
                      `${issue.title}: ${issue.description}`
                    ).join('\n\n');
                    
                    // Stop timer immediately
                    if (timerRef.current) {
                      clearInterval(timerRef.current);
                      timerRef.current = null;
                    }
                    
                    // Stop cheating detection
                    stopCheatingDetection();
                    
                    // Stop webcam recording
                    stopWebcamRecording();
                    
                    // Show alert message with safety warning (NOT the IMS EXAM PCTU not running message)
                    showAlertMessage(
                      t('studentExams.warnings.safetyIssuesDuringExam', { issues: errorMessages }),
                      'danger'
                    );
                    
                    // Exit exam - clear all exam state
                    setCurrentAttempt(null);
                    attemptIdRef.current = null;
                    setAnswers({});
                    setAnswerTimestamps({});
                    answersRef.current = {};
                    answerTimestampsRef.current = {};
                    setExamQuestions([]);
                    setShowResults(false);
                    setResults(null);
                    setCurrentPage(1);
                    
                    // Stop exam in IMS EXAM PCTU
                    fetch('http://localhost:8765/stop-exam', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({})
                    }).catch(err => console.error('Error stopping exam in IMS EXAM PCTU:', err));
                    
                    // Refresh exam list
                    fetchExams();
                    
                    // Restart auto-refresh
                    setTimeout(() => {
                      const intervalId = setInterval(() => {
                        fetchExams();
                      }, 30000);
                      return () => clearInterval(intervalId);
                    }, 1000);
                  }
                })
                .catch(error => {
                  if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                  }
                  window.safetyCheckInProgress = false;
                  // Only log if not aborted (timeout)
                  if (error.name !== 'AbortError' && error.name !== 'TimeoutError') {
                    console.warn('[EXAM SAFETY CHECK] Error checking safety status:', error);
                  }
                  // Don't kick out on network errors, just log
                });
              }
            }
            
            // Update time_remaining_seconds in background (don't wait for response)
            api.put(`/lms/attempts/${attemptId}/time-remaining`, {
              timeRemainingSeconds: newTime
            }).catch(error => {
              console.error('Error updating time remaining:', error);
              
              // Don't kick out if already kicked out due to safety issues
              if (window.examKickedOutDueToSafety) {
                console.log('[UPDATE TIME] Skipping kick out - already kicked out due to safety issues');
                return;
              }
              
              // If IMS EXAM PCTU is required but not running, kick student out
              if (error.response?.data?.requires_ims_exam_pctu) {
                console.warn('[UPDATE TIME] IMS EXAM PCTU not running - kicking out student');
                
                // Stop timer immediately
                if (timerRef.current) {
                  clearInterval(timerRef.current);
                  timerRef.current = null;
                }
                
                // Stop cheating detection
                stopCheatingDetection();
                
                // Stop webcam recording
                stopWebcamRecording();
                
                // Show alert message (only if not already kicked out due to safety)
                if (!window.examKickedOutDueToSafety) {
                  showAlertMessage(
                    error.response?.data?.message || t('studentExams.errors.imsExamPctuNotRunningStart'),
                    'danger'
                  );
                }
                
                // Exit exam - clear all exam state
                setCurrentAttempt(null);
                attemptIdRef.current = null;
                setAnswers({});
                setAnswerTimestamps({});
                answersRef.current = {};
                answerTimestampsRef.current = {};
                setExamQuestions([]);
                setShowResults(false);
                setResults(null);
                setCurrentPage(1);
                
                // Stop exam window in IMS EXAM PCTU if required (don't await in catch callback)
                if (selectedExam?.ims_exam_pctu_required === true || selectedExam?.ims_exam_pctu_required === 1) {
                  fetch('http://localhost:8765/stop-exam', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                  }).catch(err => {
                    console.error('Error stopping exam window in IMS EXAM PCTU:', err);
                  });
                }
                
                // Refresh exam list to show updated status
                fetchExams();
                
                // Restart auto-refresh
                startAutoRefresh();
              }
            });
          }
        }
        
        return newTime;
      });
    }, 1000);

    timerRef.current = timer;
  };

  const handleAutoSubmitWithId = async (attemptId) => {
    if (isSubmitting) {
      console.log('Auto-submit already in progress, skipping...');
      return;
    }
    if (!attemptId) {
      console.error('Cannot auto-submit: attempt_id is null');
      return;
    }
    
    console.log('Auto-submitting exam due to time limit...', { attemptId });
    setIsSubmitting(true);
    
    // Show notification to user
    showAlertMessage(t('studentExams.success.autoSubmit'), 'warning');
    
    // Stop webcam recording before submitting
    stopWebcamRecording();
    
    // Stop timer to prevent multiple submissions
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Submit exam with attempt_id from ref
    await submitExamWithId(attemptId);
  };

  const handleAutoSubmit = async () => {
    // Stop cheating detection before showing confirm dialog to avoid false positives
    // (clicking the dialog can trigger window blur/focus events)
    stopCheatingDetection();
    
    // Show confirm button instead of submitting immediately
    setShowConfirmSubmit(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmSubmit(false);
    setIsSubmitting(true);
    
    // Use currentAttempt state or fallback to ref
    const attemptId = currentAttempt?.attempt_id || attemptIdRef.current;
    if (!attemptId) {
      console.error('Cannot submit: attempt_id is null');
      showAlertMessage(t('studentExams.errors.cannotSubmit'), 'danger');
      setIsSubmitting(false);
      return;
    }

    // Stop webcam recording before submitting
    stopWebcamRecording();

    // Stop timer to prevent multiple submissions
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Submit exam directly (not through auto-submit)
    await submitExamWithId(attemptId);
  };

  const handleAnswerChange = async (questionId, value) => {
    const selectedAt = new Date().toISOString(); // Lưu timestamp khi chọn đáp án
    setAnswers(prev => {
      const newAnswers = {
        ...prev,
        [questionId]: value
      };
      
      // Update ref
      answersRef.current = newAnswers;
      
      // Hide warning if all questions on current page are now answered
      if (showBacktrackWarning && questionsPerPage !== 'all') {
        const qpp = parseInt(questionsPerPage);
        const startIndex = (currentPage - 1) * qpp;
        const endIndex = startIndex + qpp;
        const currentQuestions = examQuestions.slice(startIndex, endIndex);
        let allAnswered = true;
        
        for (const question of currentQuestions) {
          const answer = newAnswers[question.question_id];
          if (answer === null || answer === undefined || 
              (typeof answer === 'string' && answer.trim() === '') || 
              (Array.isArray(answer) && answer.length === 0)) {
            allAnswered = false;
            break;
          }
        }
        
        if (allAnswered) {
          setTimeout(() => setShowBacktrackWarning(false), 0);
        }
      }
      
      return newAnswers;
    });
    setAnswerTimestamps(prev => {
      const newTimestamps = {
        ...prev,
        [questionId]: selectedAt
      };
      // Update ref
      answerTimestampsRef.current = newTimestamps;
      return newTimestamps;
    });

    // Auto-save answer to database
    const attemptId = currentAttempt?.attempt_id || attemptIdRef.current;
    if (attemptId) {
      try {
        await api.post(`/lms/attempts/${attemptId}/auto-save`, {
          questionId: questionId,
          answer: value,
          selectedAt: selectedAt
        });
        // Silent save - no need to show message to user
      } catch (error) {
        console.error('Error auto-saving answer:', error);
        // Don't show error to user to avoid interrupting exam flow
      }
    }
  };

  // Check if current page questions are answered
  const checkCurrentPageAnswers = () => {
    if (questionsPerPage === 'all') return true; // All questions visible, no need to check
    
    const qpp = parseInt(questionsPerPage);
    const startIndex = (currentPage - 1) * qpp;
    const endIndex = startIndex + qpp;
    const currentQuestions = examQuestions.slice(startIndex, endIndex);
    
    // Check if all questions on current page are answered
    for (const question of currentQuestions) {
      const answer = answers[question.question_id];
      // Check for null, undefined, empty string, empty array, or null value for true_false
      if (answer === null || answer === undefined || 
          (typeof answer === 'string' && answer.trim() === '') || 
          (Array.isArray(answer) && answer.length === 0)) {
        return false; // Found unanswered question
      }
    }
    return true; // All questions answered
  };

  // Handle page change with backtrack warning
  const handlePageChange = async (direction) => {
    // If allow_backtrack is false and trying to go back, don't allow
    if ((selectedExam?.allow_backtrack === false || selectedExam?.allow_backtrack === 0) && direction === 'prev') {
      // Should not reach here if button is hidden, but just in case
      return;
    }

    // If allow_backtrack is true, allow page change without warning
    if (selectedExam?.allow_backtrack !== false && selectedExam?.allow_backtrack !== 0) {
      setShowBacktrackWarning(false); // Hide warning if shown
      let newPage;
      if (direction === 'prev') {
        newPage = Math.max(1, currentPage - 1);
      } else {
        newPage = Math.min(Math.ceil(examQuestions.length / parseInt(questionsPerPage)), currentPage + 1);
      }
      setCurrentPage(newPage);
      // Save current page to database
      await saveCurrentPage(newPage);
      return;
    }

    // If allow_backtrack is false and going forward, check if current page is answered
    if (direction === 'next') {
      const allAnswered = checkCurrentPageAnswers();
      
      if (!allAnswered) {
        // Show inline warning
        setShowBacktrackWarning(true);
        return;
      }
    }

    // All answered or going back (when allowed), proceed with page change
    setShowBacktrackWarning(false); // Hide warning
    let newPage;
    if (direction === 'prev') {
      newPage = Math.max(1, currentPage - 1);
    } else {
      newPage = Math.min(Math.ceil(examQuestions.length / parseInt(questionsPerPage)), currentPage + 1);
    }
    setCurrentPage(newPage);
    // Save current page to database
    await saveCurrentPage(newPage);
  };
  
  // Save current page to database
  const saveCurrentPage = async (page) => {
    const attemptId = currentAttempt?.attempt_id || attemptIdRef.current;
    if (attemptId && page) {
      try {
        await api.put(`/lms/attempts/${attemptId}/current-page`, {
          currentPage: page
        });
      } catch (error) {
        console.error('Error saving current page:', error);
        // Don't show error to user - this is a background operation
      }
    }
  };

  // Confirm page change after warning
  const confirmPageChange = async () => {
    setShowBacktrackWarning(false);
    const newPage = Math.min(Math.ceil(examQuestions.length / parseInt(questionsPerPage)), currentPage + 1);
    setCurrentPage(newPage);
    // Save current page to database
    await saveCurrentPage(newPage);
  };

  // Cancel page change
  const cancelPageChange = () => {
    setShowBacktrackWarning(false);
  };

  const submitExamWithId = async (attemptId) => {
    try {
      if (!attemptId) {
        console.error('Cannot submit: attempt_id is null');
        showAlertMessage(t('studentExams.errors.cannotSubmit'), 'danger');
        return;
      }

      // Stop cheating detection before submitting
      stopCheatingDetection();

      // Process any remaining logs - use currentAttempt if available, otherwise use attemptId
      const attemptForLogs = currentAttempt || (attemptId ? { attempt_id: attemptId } : null);
      if (attemptForLogs) {
        await processCheatingLogQueueWithAttempt(attemptForLogs);
      }

      // Use refs to get latest answers and timestamps (important for auto-submit)
      const latestAnswers = answersRef.current && Object.keys(answersRef.current).length > 0 
        ? answersRef.current 
        : answers;
      const latestAnswerTimestamps = answerTimestampsRef.current && Object.keys(answerTimestampsRef.current).length > 0
        ? answerTimestampsRef.current
        : answerTimestamps;

      console.log('Submitting exam with answers:', {
        attemptId,
        answersCount: Object.keys(latestAnswers).length,
        answersKeys: Object.keys(latestAnswers),
        hasTimestamps: Object.keys(latestAnswerTimestamps).length > 0
      });

      // Check if IMS EXAM PCTU is required and running before submitting
      let imsExamPCTURunning = false;
      if (selectedExam?.ims_exam_pctu_required === true || selectedExam?.ims_exam_pctu_required === 1) {
        imsExamPCTURunning = await checkIMSExamPCTURunning();
        if (!imsExamPCTURunning) {
          showAlertMessage(t('studentExams.errors.imsExamPctuNotRunning'), 'warning');
          return;
        }
      }

      const response = await api.post(`/lms/attempts/${attemptId}/submit`, {
        answers: latestAnswers,
        answerTimestamps: latestAnswerTimestamps, // Gửi timestamp khi chọn đáp án
        ims_exam_pctu_running: imsExamPCTURunning
      });

      if (response.data.success) {
        const resultData = response.data.data;
        console.log('[EXAM SUBMIT] Result data from submit:', {
          score: resultData.score,
          total_points: resultData.total_points,
          percentage: resultData.percentage,
          passed: resultData.passed
        });
        // Calculate passed if not provided by backend (fallback)
        if (resultData.passed === undefined && resultData.percentage !== undefined && selectedExam?.passing_score !== undefined) {
          resultData.passed = resultData.percentage >= selectedExam.passing_score;
        }

        // Parse show_results_after from exam or results
        let showResultsAfterConfig = {};
        try {
          const rawShowResultsAfter = selectedExam?.show_results_after || resultData.show_results_after;
          if (typeof rawShowResultsAfter === 'string') {
            showResultsAfterConfig = JSON.parse(rawShowResultsAfter);
          } else if (typeof rawShowResultsAfter === 'object' && rawShowResultsAfter !== null) {
            showResultsAfterConfig = rawShowResultsAfter;
          } else {
            // Default fallback
            showResultsAfterConfig = {
              hide_results: false,
              show_results_only: true,
              show_questions_list: false,
              show_question_result: false,
              show_question_options: false,
              show_answers: false,
              show_timestamps: false
            };
          }
        } catch (e) {
          // Default fallback
          showResultsAfterConfig = {
            hide_results: false,
            show_results_only: true,
            show_questions_list: false,
            show_question_result: false,
            show_question_options: false,
            show_answers: false,
            show_timestamps: false
          };
        }

        // Always fetch results from database to ensure we have the latest score, total_points, percentage
        // This is important because score might be recalculated or updated after submission
        try {
          const resultsResponse = await api.get(`/lms/attempts/${attemptId}/results`);
          console.log('[EXAM SUBMIT] Results response from database:', resultsResponse.data);
          if (resultsResponse.data.success) {
            // Merge attempt data (including score, total_points, percentage) from database
            if (resultsResponse.data.data.attempt) {
              const attemptData = resultsResponse.data.data.attempt;
              console.log('[EXAM SUBMIT] Attempt data from database:', {
                score: attemptData.score,
                total_points: attemptData.total_points,
                percentage: attemptData.percentage,
                passed: attemptData.passed
              });
              // Always use database values if they exist (they are the source of truth)
              if (attemptData.score !== null && attemptData.score !== undefined) {
                resultData.score = parseFloat(attemptData.score);
                console.log('[EXAM SUBMIT] ✅ Updated score from database:', resultData.score);
              } else {
                console.warn('[EXAM SUBMIT] ⚠️ Score is null/undefined in database, keeping submit response score:', resultData.score);
              }
              if (attemptData.total_points !== null && attemptData.total_points !== undefined) {
                resultData.total_points = parseFloat(attemptData.total_points);
              }
              if (attemptData.percentage !== null && attemptData.percentage !== undefined) {
                resultData.percentage = parseFloat(attemptData.percentage);
              }
              if (attemptData.passed !== null && attemptData.passed !== undefined) {
                resultData.passed = attemptData.passed;
              }
            } else {
              console.warn('[EXAM SUBMIT] ⚠️ No attempt data in results response');
            }
            
            // If exam setting requires showing questions/options/answers, also fetch answers
            if (showResultsAfterConfig.show_questions_list || showResultsAfterConfig.show_question_options || showResultsAfterConfig.show_answers) {
              resultData.answers = resultsResponse.data.data.answers || [];
            }
            
            resultData.show_results_after = showResultsAfterConfig;
          }
        } catch (error) {
          console.error('Error fetching exam results:', error);
          // Fallback: use resultData from submit response
          resultData.show_results_after = showResultsAfterConfig;
        }
        
        console.log('[EXAM SUBMIT] Final resultData before setting state:', {
          score: resultData.score,
          total_points: resultData.total_points,
          percentage: resultData.percentage,
          passed: resultData.passed
        });

        // Ensure selectedExam has the latest total_points from exams list
        // This is important because total_points is calculated from blueprint in getStudentExams
        if (selectedExam && selectedExam.exam_id) {
          // Fetch exams to get updated total_points
          try {
            const examsResponse = await api.get('/lms/exams/student');
            const examsData = examsResponse.data?.data;
            let finalExams = [];
            
            if (Array.isArray(examsData)) {
              finalExams = examsData;
            } else if (examsData && Array.isArray(examsData.exams)) {
              finalExams = examsData.exams;
            }
            
            // Find the exam in the updated list and update selectedExam
            const updatedExam = finalExams.find(e => e.exam_id === selectedExam.exam_id);
            if (updatedExam && updatedExam.total_points) {
              setSelectedExam(prev => ({
                ...prev,
                total_points: updatedExam.total_points
              }));
              console.log('[EXAM SUBMIT] ✅ Updated selectedExam.total_points from exams list:', updatedExam.total_points);
            }
            
            setExams(finalExams);
          } catch (error) {
            console.error('Error fetching exams to update selectedExam:', error);
            // Continue with existing selectedExam
          }
        }
        
        setResults(resultData);
        setShowResults(true);
        setCurrentAttempt(null);
        attemptIdRef.current = null; // Clear ref
        setShowConfirmSubmit(false); // Hide confirm button on success
        fetchExams(); // Refresh exam list
        // Restart auto-refresh after exam submission
        startAutoRefresh();
        
        // Notify IMS EXAM PCTU app that exam has been submitted (if exam was taken in app)
        // This will disable fullscreen/kiosk and show countdown
        const urlParams = new URLSearchParams(window.location.search);
        const fromApp = urlParams.get('fromApp') === 'true' || urlParams.get('inApp') === 'true';
        
        if (fromApp && (selectedExam?.ims_exam_pctu_required === true || selectedExam?.ims_exam_pctu_required === 1)) {
          try {
            // Notify Electron app that exam has been submitted
            await fetch('http://localhost:8765/exam-submitted', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                examId: selectedExam?.exam_id,
                attemptId: attemptId
              })
            });
            console.log('[EXAM SUBMIT] ✅ Notified IMS EXAM PCTU app about exam submission');
          } catch (error) {
            console.warn('[EXAM SUBMIT] Could not notify IMS EXAM PCTU app (may not be running):', error);
            // Ignore error - app might already be closed or not running
          }
        }
        
        // Stop exam window in IMS EXAM PCTU if required and remove keyboard blocking script
        if (selectedExam?.ims_exam_pctu_required === true || selectedExam?.ims_exam_pctu_required === 1) {
          try {
            await fetch('http://localhost:8765/stop-exam', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({})
            });
            
            // Remove keyboard blocking script
            const scriptElement = document.getElementById('ims-exam-pctu-keyboard-block');
            if (scriptElement) {
              // Try to call cleanup function if available
              try {
                if (window.imsExamPCTUCleanup) {
                  window.imsExamPCTUCleanup();
                  delete window.imsExamPCTUCleanup;
                }
              } catch (e) {
                console.warn('Error calling cleanup function:', e);
              }
              scriptElement.remove();
              
              // Also remove DevTools warning if present
              const devToolsWarning = document.getElementById('ims-exam-pctu-devtools-warning');
              if (devToolsWarning) {
                devToolsWarning.remove();
              }
              
              console.log('[EXAM SUBMIT] ✅ Keyboard blocking script removed');
            }
          } catch (error) {
            console.error('Error stopping exam window in IMS EXAM PCTU:', error);
            // Ignore error - app might already be closed
          }
        } else {
          // Remove keyboard blocking script even if IMS EXAM PCTU is not required
          const scriptElement = document.getElementById('ims-exam-pctu-keyboard-block');
          if (scriptElement) {
            // Try to call cleanup function if available
            try {
              if (window.imsExamPCTUCleanup) {
                window.imsExamPCTUCleanup();
                delete window.imsExamPCTUCleanup;
              }
            } catch (e) {
              console.warn('Error calling cleanup function:', e);
            }
            scriptElement.remove();
            
            // Also remove DevTools warning if present
            const devToolsWarning = document.getElementById('ims-exam-pctu-devtools-warning');
            if (devToolsWarning) {
              devToolsWarning.remove();
            }
            
            console.log('[EXAM SUBMIT] ✅ Keyboard blocking script removed');
          }
        }
      }
    } catch (error) {
      console.error('Error submitting exam:', error);

      if (error.response?.data?.requires_ims_exam_pctu) {
        showAlertMessage(error.response?.data?.message || t('studentExams.errors.imsExamPctuNotRunning'), 'warning');
        setShowConfirmSubmit(false);
        return;
      }

      showAlertMessage(t('studentExams.errors.submitExam'), 'danger');
      setShowConfirmSubmit(false); // Hide confirm button on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitExam = async () => {
    // Use currentAttempt state or fallback to ref
    const attemptId = currentAttempt?.attempt_id || attemptIdRef.current;
    if (!attemptId) {
      console.error('Cannot submit: attempt_id is null');
      showAlertMessage(t('studentExams.errors.cannotSubmit'), 'danger');
      return;
    }
    await submitExamWithId(attemptId);
  };

  // =====================================================
  // CHEATING DETECTION TRACKING
  // =====================================================

  const logCheatingEvent = async (eventType, eventData, severity = 'medium', description = '', sendImmediately = false) => {
    if (!currentAttempt || !currentAttempt.attempt_id) return;

    try {
      const logData = {
        event_type: eventType,
        event_data: {
          ...eventData,
          timestamp: new Date().toISOString(),
          tab_switch_count: tabSwitchCountRef.current
        },
        severity,
        description
      };

      // For critical events (high severity), send immediately
      // For other events, queue and batch send
      if (sendImmediately || severity === 'high') {
        try {
          console.log('🚨 Sending cheating log immediately:', eventType, logData);
          await api.post(`/lms/attempts/${currentAttempt.attempt_id}/cheating-logs`, logData);
          console.log('✅ Cheating log sent successfully:', eventType);
        } catch (error) {
          console.error('❌ Error sending cheating log immediately:', error);
          // If immediate send fails, add to queue for retry
          cheatingLogQueueRef.current.push(logData);
        }
      } else {
        // Queue the log for batch processing
        cheatingLogQueueRef.current.push(logData);

        // Process queue with debounce (only for non-critical events)
        if (cheatingLogQueueRef.current.length === 1) {
          setTimeout(() => {
            processCheatingLogQueue();
          }, 2000); // Increased to 2 seconds for less critical events
        }
      }
    } catch (error) {
      console.error('Error logging cheating event:', error);
    }
  };

  const processCheatingLogQueue = async () => {
    // Use currentAttempt from state
    if (!currentAttempt || !currentAttempt.attempt_id) return;
    processCheatingLogQueueWithAttempt(currentAttempt);
  };

  const processCheatingLogQueueWithAttempt = async (attempt) => {
    if (!attempt || !attempt.attempt_id) return;
    if (cheatingLogQueueRef.current.length === 0) return;

    const logsToSend = [...cheatingLogQueueRef.current];
    cheatingLogQueueRef.current = [];

    console.log(`📤 Processing cheating log queue: ${logsToSend.length} logs`);

    for (const logData of logsToSend) {
      try {
        console.log('📤 Sending queued cheating log:', logData.event_type);
        const response = await api.post(`/lms/attempts/${attempt.attempt_id}/cheating-logs`, logData);
        console.log('✅ Queued cheating log sent successfully:', logData.event_type, response.data);
      } catch (error) {
        console.error('❌ Error sending queued cheating log:', logData.event_type, error);
        // Re-queue failed logs
        cheatingLogQueueRef.current.push(logData);
      }
    }
  };

  const startCheatingDetection = (attemptDataParam = null) => {
    // Use passed attemptData or fallback to currentAttempt state
    const attempt = attemptDataParam || currentAttempt;

    if (!attempt || !attempt.attempt_id || isTrackingActiveRef.current) {
      console.log('⚠️ Cannot start cheating detection:', {
        hasAttempt: !!attempt,
        attemptId: attempt?.attempt_id,
        isTrackingActive: isTrackingActiveRef.current,
        attemptDataParam: !!attemptDataParam,
        currentAttempt: !!currentAttempt
      });
      return;
    }

    console.log('🚀 Starting cheating detection for attempt:', attempt.attempt_id);

    // Store attempt reference for event handlers
    const attemptRef = attempt;

    isTrackingActiveRef.current = true;
    tabSwitchCountRef.current = 0;
    lastVisibilityChangeRef.current = Date.now();

    // Log exam start - use attemptRef instead of currentAttempt
    const logCheatingEventWithAttempt = async (eventType, eventData, severity = 'medium', description = '', sendImmediately = false) => {
      if (!attemptRef || !attemptRef.attempt_id) return;

      try {
        const logData = {
          event_type: eventType,
          event_data: {
            ...eventData,
            timestamp: new Date().toISOString(),
            tab_switch_count: tabSwitchCountRef.current
          },
          severity,
          description
        };

        // For critical events (high severity), send immediately
        // For other events, queue and batch send
        if (sendImmediately || severity === 'high') {
          try {
            console.log('🚨 Sending cheating log immediately:', eventType, logData);
            const response = await api.post(`/lms/attempts/${attemptRef.attempt_id}/cheating-logs`, logData);
            console.log('✅ Cheating log sent successfully:', eventType, response.data);
          } catch (error) {
            // Check if it's a CSRF error (403) - api.js should handle retry automatically
            if (error.response?.status === 403) {
              const errorMessage = error.response?.data?.message || '';
              const isCSRFError = errorMessage.includes('CSRF') ||
                errorMessage.includes('csrf') ||
                errorMessage.includes('không được cung cấp') ||
                errorMessage.includes('không hợp lệ');

              if (isCSRFError) {
                console.warn('⚠️ CSRF error detected, api.js should retry automatically. If this persists, CSRF token may need refresh.');
                // Don't add to queue if it's a CSRF error - let api.js handle retry
                // If retry fails, the error will be logged below
                if (error.config?._retry) {
                  // Already retried, add to queue for later
                  cheatingLogQueueRef.current.push(logData);
                }
              } else {
                // 403 but not CSRF - likely permission issue
                console.error('❌ Permission denied (403) for cheating log:', eventType, error.response?.data);
                // Add to queue for retry later
                cheatingLogQueueRef.current.push(logData);
              }
            } else {
              // Other errors (network, timeout, etc.)
              console.error('❌ Error sending cheating log immediately:', eventType, error.response?.status || error.message);
              // If immediate send fails, add to queue for retry
              cheatingLogQueueRef.current.push(logData);
            }
          }
        } else {
          // Queue the log for batch processing
          cheatingLogQueueRef.current.push(logData);

          // Process queue with debounce (only for non-critical events)
          if (cheatingLogQueueRef.current.length === 1) {
            setTimeout(() => {
              processCheatingLogQueueWithAttempt(attemptRef);
            }, 2000); // Increased to 2 seconds for less critical events
          }
        }
      } catch (error) {
        console.error('Error logging cheating event:', error);
      }
    };

    // Log exam start
    logCheatingEventWithAttempt('exam_started', {
      start_time: new Date().toISOString()
    }, 'low', t('studentExams.warnings.examStart'), false);

    // 1. Page Visibility API - Detect tab switching
    // Helper function to save time remaining immediately
    const saveTimeRemaining = () => {
      const attemptId = attemptIdRef.current;
      const currentTime = timeRemainingRef.current; // Use ref to get latest value
      if (attemptId && currentTime > 0) {
        api.put(`/lms/attempts/${attemptId}/time-remaining`, {
          timeRemainingSeconds: currentTime
        }).catch(error => {
          console.error('Error saving time remaining:', error);
        });
      }
    };

    const handleVisibilityChange = () => {
      if (!isTrackingActiveRef.current) {
        console.log('⚠️ Visibility change detected but tracking is not active');
        return;
      }

      const now = Date.now();
      const isHidden = document.hidden;
      const visibilityState = document.visibilityState;

      console.log('👁️ Visibility change:', {
        hidden: isHidden,
        visibilityState: visibilityState,
        attemptId: attemptRef?.attempt_id
      });

      if (isHidden) {
        // Tab bị ẩn - user chuyển tab
        // Lưu thời điểm tab bị ẩn để tính thời gian khi tab được hiển thị lại
        lastVisibilityChangeRef.current = now;
        tabSwitchCountRef.current += 1;

        console.log('🔴 Tab hidden - Tab switch detected:', {
          switchCount: tabSwitchCountRef.current,
          attemptId: attemptRef?.attempt_id
        });

        // Hiển thị thông báo phát hiện gian lận
        showAlert(t('studentExams.warnings.cheatingTabSwitch'), 'danger', t('studentExams.warnings.cheatingTabSwitch'));

        logCheatingEventWithAttempt(
          'page_visibility_hidden',
          {
            action: 'hidden',
            switch_count: tabSwitchCountRef.current,
            visibility_state: visibilityState
          },
          'high',
          `Chuyển tab hoặc minimize window (Lần thứ ${tabSwitchCountRef.current})`,
          true // Send immediately
        );
      } else {
        // Tab được hiển thị lại
        // Tính thời gian tab bị ẩn từ lần cuối cùng tab bị ẩn đến bây giờ
        const hiddenDuration = lastVisibilityChangeRef.current ? now - lastVisibilityChangeRef.current : 0;

        // Chỉ log nếu có thời gian ẩn hợp lệ (lớn hơn 0)
        if (hiddenDuration > 0) {
          console.log('🟢 Tab visible - User returned to tab after:', {
            duration: Math.round(hiddenDuration / 1000),
            seconds: Math.round(hiddenDuration / 1000),
            attemptId: attemptRef?.attempt_id
          });

          // Hiển thị thông báo phát hiện gian lận
          showAlert(t('studentExams.warnings.cheatingReturned', { seconds: Math.round(hiddenDuration / 1000) }), 'danger', t('studentExams.warnings.cheatingReturned', { seconds: Math.round(hiddenDuration / 1000) }));

          logCheatingEventWithAttempt(
            'page_visibility_visible',
            {
              action: 'visible',
              hidden_duration_ms: hiddenDuration,
              switch_count: tabSwitchCountRef.current,
              visibility_state: visibilityState
            },
            'medium',
            t('studentExams.warnings.cheatingReturned', { seconds: Math.round(hiddenDuration / 1000) }),
            true // Send immediately
          );
        }

        // Cập nhật thời điểm hiện tại để dùng cho lần ẩn tiếp theo
        lastVisibilityChangeRef.current = now;
      }
    };

    // 2. Window Focus/Blur Events
    const handleWindowBlur = () => {
      if (!isTrackingActiveRef.current) return;

      // Save time remaining immediately when window loses focus (in case of crash)
      saveTimeRemaining();

      console.log('🔴 Window blur - Window lost focus');

      // Hiển thị thông báo phát hiện gian lận
      showAlert(t('studentExams.warnings.cheatingWindowBlur'), 'danger', t('studentExams.warnings.cheatingWindowBlur'));

      logCheatingEventWithAttempt(
        'window_blur',
        {
          action: 'blur',
          timestamp: new Date().toISOString()
        },
        'high',
        t('studentExams.warnings.cheatingWindowBlur'),
        true // Send immediately
      );
    };

    const handleWindowFocus = () => {
      if (!isTrackingActiveRef.current) return;

      console.log('🟢 Window focus - Window gained focus');

      logCheatingEventWithAttempt(
        'window_focus',
        {
          action: 'focus',
          timestamp: new Date().toISOString()
        },
        'medium',
        t('studentExams.warnings.cheatingWindowFocus'),
        true // Send immediately
      );
    };

    // 3. BeforeUnload Event - Detect page exit/reload
    const handleBeforeUnload = (e) => {
      if (!isTrackingActiveRef.current) return;

      // Log the event before page unloads
      const logData = {
        event_type: 'before_unload',
        event_data: {
          action: 'attempted_exit',
          timestamp: new Date().toISOString(),
          tab_switch_count: tabSwitchCountRef.current
        },
        severity: 'high',
        description: t('studentExams.warnings.beforeUnloadDescription')
      };

      // Use sendBeacon for reliable delivery during page unload
      // Note: sendBeacon doesn't support custom headers, so we need to send as FormData or text
      if (navigator.sendBeacon && attemptRef?.attempt_id) {
        try {
          // Send as FormData for better compatibility
          const formData = new FormData();
          formData.append('event_type', logData.event_type);
          formData.append('event_data', JSON.stringify(logData.event_data));
          formData.append('severity', logData.severity);
          formData.append('description', logData.description);

          navigator.sendBeacon(
            `/api/lms/attempts/${attemptRef.attempt_id}/cheating-logs`,
            formData
          );
        } catch (error) {
          console.error('Error sending beforeunload log:', error);
        }
      }

      // Show warning message
      e.preventDefault();
      e.returnValue = t('studentExams.warnings.beforeUnload');
      return e.returnValue;
    };

    // Attach event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Store cleanup function in a ref so it persists
    const cleanupRef = {
      cleanup: () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        isTrackingActiveRef.current = false;

        // Process any remaining logs
        processCheatingLogQueueWithAttempt(attemptRef);

        // Log exam end
        if (attemptRef?.attempt_id) {
          logCheatingEventWithAttempt('exam_ended', {
            end_time: new Date().toISOString(),
            total_tab_switches: tabSwitchCountRef.current
          }, 'low', t('studentExams.warnings.examEnd'), false);
        }
      }
    };

    // Store cleanup reference for later use
    if (attemptRef) {
      attemptRef._cheatingDetectionCleanup = cleanupRef.cleanup;
    }
  };

  const stopCheatingDetection = () => {
    if (currentAttempt && currentAttempt._cheatingDetectionCleanup) {
      currentAttempt._cheatingDetectionCleanup();
      delete currentAttempt._cheatingDetectionCleanup;
    }
    isTrackingActiveRef.current = false;
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper function to format number: remove .00 but keep other decimals like .40
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    const formatted = parseFloat(num).toFixed(2);
    // Remove only .00 at the end, keep other decimals like .40, .50, etc.
    // Example: 4.00 -> "4", 2.40 -> "2.40", 2.41 -> "2.41", 100.00 -> "100"
    return formatted.replace(/\.00$/, '');
  };

  const formatTimeSpent = (seconds) => {
    if (!seconds || seconds === 0) return null;

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return t('studentExams.timeSpent.hours', { hours, minutes, seconds: secs });
    } else if (minutes > 0) {
      return t('studentExams.timeSpent.minutes', { minutes, seconds: secs });
    } else {
      return t('studentExams.timeSpent.seconds', { seconds: secs });
    }
  };

  const getStatusBadge = (exam) => {
    const now = new Date();
    // Sử dụng available_from và available_until (thời gian thực tế sinh viên có thể làm bài)
    // Fallback về scheduled_start và scheduled_end nếu không có
    const start = exam.available_from ? new Date(exam.available_from) :
      (exam.scheduled_start ? new Date(exam.scheduled_start) : null);
    const end = exam.available_until ? new Date(exam.available_until) :
      (exam.scheduled_end ? new Date(exam.scheduled_end) : null);
    const isApproved = exam.is_approved === 1 || exam.is_approved === true;

    // Kiểm tra trạng thái duyệt trước
    if (!isApproved) {
      return <Badge bg="secondary">{t('studentExams.status.notApproved')}</Badge>;
    }

    // Nếu có thời gian bắt đầu và hiện tại chưa đến thời gian bắt đầu
    if (start && now < start) {
      return <Badge bg="info">{t('studentExams.status.notOpened')}</Badge>;
    }

    // Nếu có thời gian kết thúc và hiện tại đã qua thời gian kết thúc
    if (end && now > end) {
      return <Badge bg="dark">{t('studentExams.status.closed')}</Badge>;
    }

    // Nếu có thời gian bắt đầu và hiện tại đã đến hoặc qua thời gian bắt đầu
    // và (không có thời gian kết thúc hoặc hiện tại chưa qua thời gian kết thúc)
    if (start && now >= start && (!end || now <= end)) {
      return <Badge bg="success">{t('studentExams.status.open')}</Badge>;
    }

    // Trường hợp không có thời gian bắt đầu/kết thúc hoặc logic không khớp
    // Nếu đã được duyệt và không có ràng buộc thời gian, coi như sẵn sàng
    return <Badge bg="primary">{t('studentExams.status.ready')}</Badge>;
  };

  const getTypeBadge = (type) => {
    const config = {
      quiz: { bg: 'primary', text: t('studentExams.types.quiz') },
      midterm: { bg: 'warning', text: t('studentExams.types.midterm') },
      final: { bg: 'danger', text: t('studentExams.types.final') },
      practice: { bg: 'info', text: t('studentExams.types.practice') },
      osce: { bg: 'success', text: t('studentExams.types.osce') }
    };
    const c = config[type] || config.quiz;
    return <Badge bg={c.bg}>{c.text}</Badge>;
  };

  // If taking exam, show exam interface
  if (currentAttempt && selectedExam) {
    // Note: exam data is already loaded in selectedExam from confirmStartExam
    // No need to fetch again here to avoid infinite loop

    return (
      <div className="container-fluid exam-container">
        {/* Exam Header */}
        <div className="exam-header">
          <div className="exam-header-content">
            <div className="exam-title-section">
              <h2 className="exam-title">{selectedExam.exam_title}</h2>
              <div className="exam-timer">
                <i className="fas fa-clock"></i>
                <span className="timer-text">{t('studentExams.examTaking.timeRemaining')}</span>
                <span className={`timer-value ${timeRemaining < 300 ? 'timer-warning' : ''}`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>
            <div className="exam-actions" ref={examActionsRef} style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
              {/* Confirm OK Button - Appears with animation */}
              {showConfirmSubmit && (
                <button
                  className="confirm-submit-button"
                  onClick={handleConfirmSubmit}
                  disabled={isSubmitting}
                >
                  <span>{t('studentExams.actions.ok')}</span>
                </button>
              )}
              <button
                className="animated-submit-button"
                onClick={handleAutoSubmit}
                disabled={isSubmitting || showConfirmSubmit}
                style={{
                  '--spread': '90deg',
                  '--shimmer-color': '#ffffff',
                  '--radius': '8px',
                  '--speed': '1.5s',
                  '--cut': '2px',
                  '--bg': 'radial-gradient(ellipse 80% 50% at 50% 120%, #256176, #256176)'
                }}
              >
                <div className="shimmer-overlay">
                  <div className="shimmer-rotating">
                    <div className="shimmer-gradient"></div>
                  </div>
                </div>
                <div className="shimmer-inner"></div>
                {isSubmitting ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" style={{ position: 'relative', zIndex: 10, color: 'white' }} />
                    <span className="submit-button-text">{t('studentExams.actions.submitting')}</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="arr-2" viewBox="0 0 24 24">
                      <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z"></path>
                    </svg>
                    <span className="submit-button-text">{t('studentExams.actions.submitExam')}</span>
                    <span className="circle"></span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="arr-1" viewBox="0 0 24 24">
                      <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z"></path>
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
          {/* Progress Bar - Footer of exam-header */}
          {(selectedExam?.show_progress_bar !== false && selectedExam?.show_progress_bar !== 0) && (
            <div className="exam-header-footer">
              {(() => {
                // Calculate answered count once
                const answeredCount = examQuestions.filter(q => {
                  const answer = answers[q.question_id];
                  return answer !== null && answer !== undefined && 
                         (typeof answer !== 'string' || answer.trim() !== '') &&
                         (typeof answer !== 'object' || (Array.isArray(answer) && answer.length > 0));
                }).length;
                const totalQuestions = examQuestions.length;
                const progressPercentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
                
                // Determine label based on show_answered_count setting
                const label = (selectedExam?.show_answered_count !== false && selectedExam?.show_answered_count !== 0)
                  ? t('studentExams.examTaking.answeredCount', { answered: answeredCount, total: totalQuestions })
                  : '';
                
                return (
                  <div className="exam-progress-container">
                    <ProgressBar 
                      now={progressPercentage}
                      label={label}
                      variant="success"
                      className="exam-progress-bar"
                      style={{ height: '24px', borderRadius: '12px' }}
                    />
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Instructions and Webcam */}
        <div className="exam-info-section">
          <div className={`exam-info-grid ${(selectedExam?.webcam_required === true || selectedExam?.webcam_required === 1) ? 'has-webcam' : ''}`}>
            <div className="exam-instructions-card">
              <div className="section-header">
                <span>{selectedExam?.instructions_title || t('studentExams.examTaking.instructionsTitle')}</span>
              </div>
              <ul className="instructions-list">
                {(() => {
                  const instructions = selectedExam?.instructions_list;
                  if (instructions) {
                    try {
                      const parsed = typeof instructions === 'string' ? JSON.parse(instructions) : instructions;
                      if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed.map((item, index) => (
                          <li key={index}>{item}</li>
                        ));
                      }
                    } catch (e) {
                      console.warn('Failed to parse instructions_list:', e);
                    }
                  }
                  // Fallback to default instructions
                  return (
                    <>
                      <li>{t('studentExams.examTaking.defaultInstructions.readCarefully')}</li>
                      <li>{t('studentExams.examTaking.defaultInstructions.autoSubmit')}</li>
                      <li>{t('studentExams.examTaking.defaultInstructions.noTabSwitch')}</li>
                    </>
                  );
                })()}
              </ul>
            </div>
            {(selectedExam?.webcam_required === true || selectedExam?.webcam_required === 1) && (
              <div className="exam-webcam-card">
                {webcamError ? (
                  <div className="webcam-error">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>{webcamError}</span>
                  </div>
                ) : (
                  <div className="webcam-preview">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="webcam-video"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Questions Container */}
        <div className="exam-questions-wrapper">
          {loadingQuestions ? (
            <div className="exam-loading">
              <Spinner animation="border" variant="primary" />
              <p className="loading-text">{t('studentExams.examTaking.loadingQuestions')}</p>
            </div>
          ) : examQuestions.length === 0 ? (
            <div className="exam-empty">
              <i className="fas fa-inbox"></i>
              <p>{t('studentExams.examTaking.noQuestions')}</p>
            </div>
          ) : (
            <div className="questions-container">
              {/* Pagination controls - Top */}


              {/* Calculate pagination */}
              {(() => {
                const qpp = questionsPerPage === 'all' ? examQuestions.length : parseInt(questionsPerPage);
                const startIndex = (currentPage - 1) * qpp;
                const endIndex = startIndex + qpp;
                const currentQuestions = examQuestions.slice(startIndex, endIndex);

                return currentQuestions.map((question, localIndex) => {
                  const globalIndex = startIndex + localIndex;
                  return (
                    <div key={question.question_id || globalIndex} className="question-item-exam">
                      {/* Question Header */}
                      <div className="question-header-exam">
                        <div className="question-number-exam">{t('studentExams.examTaking.question', { number: globalIndex + 1 })}</div>
                        <div className="question-content-exam">
                          <div className="question-text-exam">{question.question_text || 'N/A'}</div>
                          {selectedExam?.show_points_per_question === true && (
                            <div className="question-points-exam">{t('studentExams.examTaking.points', { points: question.points || 1 })}</div>
                          )}
                        </div>
                      </div>

                      {/* Render options based on question type */}
                      <div className="question-options-container-exam">
                        {question.question_type === 'mcq' || question.question_type === 'multiple_choice' ? (
                          <>
                            {question.options && question.options.length > 0 ? (
                              <div className="options-list-exam">
                                {question.options.map((option, optIndex) => (
                                  <label
                                    key={option.option_id || optIndex}
                                    className={`option-item-exam ${answers[question.question_id] === String(option.option_id) ? 'option-selected' : ''}`}
                                  >
                                    <input
                                      type="radio"
                                      id={`q${question.question_id}_opt${optIndex}`}
                                      name={`question_${question.question_id}`}
                                      checked={answers[question.question_id] === String(option.option_id)}
                                      onChange={() => handleAnswerChange(question.question_id, String(option.option_id))}
                                    />
                                    <span>{option.option_text || 'N/A'}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <p className="text-muted">Không có đáp án</p>
                            )}
                          </>
                        ) : question.question_type === 'multiple_response' ? (
                          <>
                            {question.options && question.options.length > 0 ? (
                              <div className="options-list-exam">
                                {question.options.map((option, optIndex) => (
                                  <label
                                    key={option.option_id || optIndex}
                                    className={`option-item-exam ${Array.isArray(answers[question.question_id]) && answers[question.question_id].includes(String(option.option_id)) ? 'option-selected' : ''}`}
                                  >
                                    <input
                                      type="checkbox"
                                      id={`q${question.question_id}_opt${optIndex}`}
                                      checked={Array.isArray(answers[question.question_id]) && answers[question.question_id].includes(String(option.option_id))}
                                      onChange={(e) => {
                                        const currentAnswers = Array.isArray(answers[question.question_id]) ? [...answers[question.question_id]] : [];
                                        if (e.target.checked) {
                                          currentAnswers.push(String(option.option_id));
                                        } else {
                                          const index = currentAnswers.indexOf(String(option.option_id));
                                          if (index > -1) currentAnswers.splice(index, 1);
                                        }
                                        handleAnswerChange(question.question_id, currentAnswers);
                                      }}
                                    />
                                    <span>{option.option_text || 'N/A'}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <p className="text-muted">Không có đáp án</p>
                            )}
                          </>
                        ) : question.question_type === 'true_false' ? (
                          <div className="options-list-exam">
                            <label
                              className={`option-item-exam ${answers[question.question_id] === 'true' ? 'option-selected' : ''}`}
                            >
                              <input
                                type="radio"
                                id={`q${question.question_id}_true`}
                                name={`question_${question.question_id}`}
                                checked={answers[question.question_id] === 'true'}
                                onChange={() => handleAnswerChange(question.question_id, 'true')}
                              />
                              <span>{t('studentExams.examTaking.true')}</span>
                            </label>
                            <label
                              className={`option-item-exam ${answers[question.question_id] === 'false' ? 'option-selected' : ''}`}
                            >
                              <input
                                type="radio"
                                id={`q${question.question_id}_false`}
                                name={`question_${question.question_id}`}
                                checked={answers[question.question_id] === 'false'}
                                onChange={() => handleAnswerChange(question.question_id, 'false')}
                              />
                              <span>{t('studentExams.examTaking.false')}</span>
                            </label>
                          </div>
                        ) : (
                          <div className="answer-textarea-container-exam">
                            <textarea
                              className="answer-textarea-exam"
                              rows={4}
                              placeholder={t('studentExams.examTaking.answerPlaceholder')}
                              value={answers[question.question_id] || ''}
                              onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Pagination controls - Bottom */}
              {questionsPerPage !== 'all' && (
                <div style={{ position: 'relative' }}>
                  {/* Warning Alert - Show above pagination controls */}
                  {showBacktrackWarning && (
                    <>
                      {/* Backdrop overlay - click to close */}
                      <div
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.1)',
                          zIndex: 999,
                          cursor: 'pointer'
                        }}
                        onClick={cancelPageChange}
                      />
                      {/* Alert container */}
                      <div 
                        ref={warningAlertRef}
                        style={{ 
                          position: 'fixed', 
                          bottom: '20%', 
                          left: '50%',
                          transform: 'translate(-50%, 50%)',
                          zIndex: 1000,
                          width: 'auto',
                          maxWidth: '90%'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Alert variant="warning" className="mb-0" style={{ 
                          padding: '10px 16px', 
                          backgroundColor: '#fffbf0',
                          borderColor: '#ffd700',
                          color: '#856404',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                          <i className="fas fa-exclamation-triangle"></i>
                          <span style={{ flex: 1, minWidth: '200px' }}>{t('studentExams.examTaking.backtrackWarning')}</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <Button
                              variant="outline-warning"
                              size="sm"
                              onClick={confirmPageChange}
                            >
                              {t('studentExams.examTaking.confirmPageChange')}
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={cancelPageChange}
                            >
                              {t('studentExams.examTaking.cancelPageChange')}
                            </Button>
                          </div>
                        </Alert>
                      </div>
                    </>
                  )}
                  <div className="pagination-controls-bottom">
                    {/* Only show "Câu trước" button if allow_backtrack is not false */}
                    {(selectedExam?.allow_backtrack !== false && selectedExam?.allow_backtrack !== 0) && (
                      <Button
                        className="btn-pagination"
                        onClick={() => {
                          if (currentPage === 1) return;
                          handlePageChange('prev');
                        }}
                        disabled={currentPage === 1}
                      >
                        <i className="fas fa-chevron-left"></i>
                        <span>{t('studentExams.actions.previous')}</span>
                      </Button>
                    )}
                    {(selectedExam?.show_page_number !== false && selectedExam?.show_page_number !== 0) && (
                      <div className="pagination-info-center">
                        <span>{t('studentExams.examTaking.pageInfo', { current: currentPage, total: Math.ceil(examQuestions.length / parseInt(questionsPerPage)) })}</span>
                      </div>
                    )}
                    <Button
                      className="btn-pagination"
                      onClick={() => {
                        if (currentPage >= Math.ceil(examQuestions.length / parseInt(questionsPerPage))) return;
                        handlePageChange('next');
                      }}
                      disabled={currentPage >= Math.ceil(examQuestions.length / parseInt(questionsPerPage))}
                    >
                      <span>{t('studentExams.actions.next')}</span>
                      <i className="fas fa-chevron-right"></i>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // If showing results
  // Check if results should be shown based on show_results_after config
  if (showResults && results) {
    // Parse show_results_after config
    let showResultsAfterConfig = {};
    try {
      if (typeof results.show_results_after === 'string') {
        showResultsAfterConfig = JSON.parse(results.show_results_after);
      } else if (typeof results.show_results_after === 'object' && results.show_results_after !== null) {
        showResultsAfterConfig = results.show_results_after;
      } else {
        // Default: show results
        showResultsAfterConfig = {
          hide_results: false,
          show_results_only: true
        };
      }
    } catch (e) {
      // Default: show results
      showResultsAfterConfig = {
        hide_results: false,
        show_results_only: true
      };
    }

    // If hide_results is true, don't show anything
    if (showResultsAfterConfig.hide_results) {
      return (
        <div className="container-fluid session-main-container">
          <div className="session-header">
            <div className="header-content">
              <div className="header-title">
                <h1>{t('studentExams.results.title')}</h1>
                <p className="header-subtitle">{selectedExam?.exam_title}</p>
              </div>
            </div>
          </div>
          <div className="student-detail-body">
            <div className="student-detail-container">
              <Alert variant="info" className="text-center">
                <i className="fas fa-info-circle me-2"></i>
                {t('studentExams.results.notShown')}
              </Alert>
              <div className="text-center mt-4">
                <button
                  className="create-session-btn"
                  onClick={() => {
                    setShowResults(false);
                    setResults(null);
                    setSelectedExam(null);
                    startAutoRefresh();
                  }}
                >
                  <i className="fas fa-arrow-left me-2"></i>{t('studentExams.actions.backToList')}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Debug: Log results data
    console.log('[EXAM RESULTS] Results data:', {
      score: results.score,
      total_points: results.total_points,
      percentage: results.percentage,
      selectedExam_total_points: selectedExam?.total_points,
      selectedExam_exam_id: selectedExam?.exam_id
    });
    
    const score = parseFloat(results.score || 0);
    
    // Get total_points: Use the same logic as "Xác nhận bắt đầu làm bài" modal
    // Priority: selectedExam.total_points (calculated from blueprint in getStudentExams)
    // This is the same value shown in the start modal and exam list
    // Fallback to results.total_points only if selectedExam is not available or total_points is 0
    let totalPoints = 0;
    if (selectedExam && selectedExam.total_points && parseFloat(selectedExam.total_points) > 0) {
      totalPoints = parseFloat(selectedExam.total_points);
      console.log('[EXAM RESULTS] ✅ Using total_points from selectedExam:', totalPoints);
    } else if (results.total_points && parseFloat(results.total_points) > 0) {
      totalPoints = parseFloat(results.total_points);
      console.log('[EXAM RESULTS] ⚠️ Using total_points from results (selectedExam not available or 0):', totalPoints);
    } else {
      // Last resort: try to find exam from exams list
      const examFromList = exams.find(exam => exam.exam_id === selectedExam?.exam_id);
      if (examFromList && examFromList.total_points && parseFloat(examFromList.total_points) > 0) {
        totalPoints = parseFloat(examFromList.total_points);
        console.log('[EXAM RESULTS] ✅ Using total_points from exams list:', totalPoints);
      } else {
        totalPoints = 0;
        console.warn('[EXAM RESULTS] ⚠️ Could not find valid total_points, using 0');
      }
    }

    // Calculate percentage from score and total_points
    // Always recalculate to ensure accuracy: percentage = (score / total_points) * 100
    let percentage = 0;
    if (totalPoints > 0 && score >= 0) {
      percentage = (score / totalPoints) * 100;
    } else if (results.percentage !== undefined && !isNaN(parseFloat(results.percentage))) {
      // Fallback to backend percentage if calculation not possible
      percentage = parseFloat(results.percentage);
    }

    const passingScore = parseFloat(results.passing_score || selectedExam?.passing_score || 60);

    // Calculate required score: passingScore% of totalPoints
    // Example: 60% of 10 = 6.0, 60% of 50 = 30.0, 60% of 3.00 = 1.80
    const requiredScore = totalPoints > 0 ? (totalPoints * passingScore) / 100 : 0;

    // Helper function to format number: remove .00 but keep other decimals like .40
    const formatNumber = (num) => {
      const formatted = num.toFixed(2);
      // Remove only .00 at the end, keep other decimals like .40, .50, etc.
      // Example: 4.00 -> "4", 2.40 -> "2.40", 2.41 -> "2.41", 100.00 -> "100"
      return formatted.replace(/\.00$/, '');
    };

    // Determine passed: ALWAYS recalculate based on percentage comparison with passingScore
    // Example: 66.67% >= 60% = passed, 55% >= 60% = not passed
    // Do NOT use backend results.passed as it may be incorrect
    // Do NOT use score comparison or 100-point default
    // This works for any total_points value (10, 30, 50, 100, etc.)
    const passed = percentage >= passingScore;

    // Only show statistics if show_results_only is enabled
    const shouldShowStatistics = showResultsAfterConfig.show_results_only;

    return (
      <div className="container-fluid session-main-container">
        <div className="session-header">
          <div className="header-content">
            <div className="header-title">
              <h1>Kết quả thi</h1>
              <p className="header-subtitle">{selectedExam?.exam_title}</p>
            </div>
          </div>
        </div>

        <div className="student-detail-body">
          <div className="student-detail-container">
            {/* Statistics Cards Row - Only show if show_results_only is enabled */}
            {shouldShowStatistics && (
              <Row className="mb-4">
                <Col md={3} className="mb-3">
                  <div className="statistics-card">
                    <div className="statistics-icon text-warning">
                      <i className="fas fa-star"></i>
                    </div>
                    <div className="statistics-content">
                      <h3>{formatNumber(score)}</h3>
                      <p>{t('studentExams.results.scoreAchieved', { total: formatNumber(totalPoints) })}</p>
                    </div>
                  </div>
                </Col>
                <Col md={3} className="mb-3">
                  <div className="statistics-card">
                    <div className="statistics-icon text-info">
                      <i className="fas fa-percentage"></i>
                    </div>
                    <div className="statistics-content">
                      <h3>{formatNumber(percentage)}%</h3>
                      <p>{t('studentExams.results.percentageAchieved', { required: Math.round(passingScore) })}</p>
                    </div>
                  </div>
                </Col>
                <Col md={3} className="mb-3">
                  <div className="statistics-card">
                    <div className="statistics-icon text-success">
                      <i className="fas fa-flag-checkered"></i>
                    </div>
                    <div className="statistics-content">
                      <h3>{formatNumber(requiredScore)}</h3>
                      <p>{t('studentExams.results.minimumScore', { percent: Math.round(passingScore), total: formatNumber(totalPoints) })}</p>
                    </div>
                  </div>
                </Col>
                <Col md={3} className="mb-3">
                  <div className="statistics-card">
                    <div className={`statistics-icon ${passed ? 'text-success' : 'text-danger'}`}>
                      <i className={`fas ${passed ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                    </div>
                    <div className="statistics-content">
                      <h3>
                        {passed ? (
                          <span className="status-badge active">{t('studentExams.results.passed')}</span>
                        ) : (
                          <span className="status-badge cancelled">{t('studentExams.results.failed')}</span>
                        )}
                      </h3>
                      <p>
                        {!passed && requiredScore > score && (
                          <span className="text-danger">
                            {t('studentExams.results.needMore', { points: formatNumber(Math.max(0, requiredScore - score)) })}
                          </span>
                        )}
                        {passed && (
                          <span className="text-success">
                            {t('studentExams.results.exceeded', { points: formatNumber(score - requiredScore) })}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </Col>
              </Row>
            )}

            {/* Progress Card - Only show if show_results_only is enabled */}
            {shouldShowStatistics && (
              <div className="session-card mb-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-chart-line"></i>
                  </div>
                  <h6>{t('studentExams.results.progressTitle')}</h6>
                </div>
                <div className="card-body-modern">
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="info-label">{t('studentExams.results.currentRate')}</span>
                      <span className={`info-value ${percentage >= passingScore ? 'text-success' : 'text-danger'}`}>
                        {formatNumber(percentage)}% / {Math.round(passingScore)}%
                      </span>
                    </div>
                    <ProgressBar
                      now={Math.min(100, (percentage / passingScore) * 100)}
                      variant={passed ? 'success' : 'danger'}
                      style={{ height: '25px', borderRadius: '10px' }}
                      label={`${formatNumber(percentage)}%`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Info Card - Only show if show_results_only is enabled */}
            {shouldShowStatistics && (
              <div className="session-card mb-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-info-circle"></i>
                  </div>
                  <h6>{t('studentExams.results.detailedInfo')}</h6>
                </div>
                <div className="card-body-modern">
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-star"></i>
                      <span>{t('studentExams.results.scoreLabel')}</span>
                    </div>
                    <div className="info-value">
                      <strong>{t('studentExams.examInfo.points', { points: formatNumber(score) })}</strong>
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-flag-checkered"></i>
                      <span>{t('studentExams.results.minimumLabel')}</span>
                    </div>
                    <div className="info-value">
                      <strong>{t('studentExams.examInfo.points', { points: formatNumber(requiredScore) })}</strong> ({Math.round(passingScore)}% {t('studentExams.examInfo.percent')} {t('studentExams.examInfo.points', { points: formatNumber(totalPoints) })})
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-percentage"></i>
                      <span>{t('studentExams.results.percentageLabel')}</span>
                    </div>
                    <div className="info-value">
                      <strong className={percentage >= passingScore ? 'text-success' : 'text-danger'}>
                        {formatNumber(percentage)}%
                      </strong>
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-check-circle"></i>
                      <span>{t('studentExams.results.result')}</span>
                    </div>
                    <div className="info-value">
                      {passed ? (
                        <span className="status-badge active">{t('studentExams.results.passed')}</span>
                      ) : (
                        <span className="status-badge cancelled">{t('studentExams.results.failed')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Questions List - Show if show_questions_list, show_question_options, or show_answers is enabled */}
            {results.show_results_after && (results.show_results_after.show_questions_list || results.show_results_after.show_question_options || results.show_results_after.show_answers) && results.answers && results.answers.length > 0 && (
              <div className="session-card mb-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-list"></i>
                  </div>
                  <h6>{t('studentExams.results.questionsList')}</h6>
                </div>
                <div className="card-body-modern">
                  <div className="questions-list-container">
                    {(() => {
                      // Deduplicate answers by question_id to prevent duplicate questions from appearing
                      // This is a safety measure in case backend returns duplicates
                      const uniqueAnswersMap = new Map();
                      
                      // First pass: collect all answers, keeping only the latest for each question
                      results.answers.forEach(answer => {
                        const key = answer.question_id || answer.exam_question_id || answer.answer_id;
                        if (!key) {
                          // If no key, use answer_id as fallback
                          uniqueAnswersMap.set(`answer_${answer.answer_id}`, answer);
                          return;
                        }
                        
                        if (uniqueAnswersMap.has(key)) {
                          // Compare timestamps to keep the latest answer
                          const existing = uniqueAnswersMap.get(key);
                          const existingTimestamp = existing.updated_at || existing.created_at || existing.answer_timestamp;
                          const currentTimestamp = answer.updated_at || answer.created_at || answer.answer_timestamp;
                          if (currentTimestamp > existingTimestamp) {
                            // Replace with newer answer
                            uniqueAnswersMap.set(key, answer);
                          }
                        } else {
                          // First occurrence of this question
                          uniqueAnswersMap.set(key, answer);
                        }
                      });
                      
                      // Convert map to array and sort by question_order if available
                      const answersToDisplay = Array.from(uniqueAnswersMap.values()).sort((a, b) => {
                        const orderA = a.question_order || 0;
                        const orderB = b.question_order || 0;
                        return orderA - orderB;
                      });
                      
                      return answersToDisplay.map((answer, index) => {
                      const answerTimestamp = answer.answer_timestamp || answer.created_at;
                      const showTimestamp = results.show_results_after?.show_timestamps && answerTimestamp;
                      const showAnswer = results.show_results_after?.show_answers;
                      const showQuestionOptions = results.show_results_after?.show_question_options;

                      return (
                        <div key={answer.answer_id || index} className="question-item">
                          {/* Question Header */}
                          <div className="question-header">
                            <div className="question-number">{t('studentExams.examTaking.question', { number: index + 1 })}</div>
                            <div className="question-content">
                              <div className="question-text">{answer.question_text || 'N/A'}</div>
                              {results.show_results_after?.show_question_result && (
                                <div className="question-result">
                                    <span className={`result-badge ${answer.is_correct ? 'result-correct' : 'result-incorrect'}`}>
                                    {answer.is_correct ? t('studentExams.examTaking.true') : t('studentExams.examTaking.false')}
                                  </span>
                                  <span className="result-score">
                                    {answer.score || 0}/{answer.max_points || 0} {t('studentExams.examInfo.points', { points: '' }).trim() || 'điểm'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Question Options - All available options */}
                          {showQuestionOptions && answer.options && answer.options.length > 0 && (
                            <div className="question-options-section">
                              <div className="options-list">
                                {answer.options.map((option, optIndex) => (
                                  <div key={option.option_id || optIndex} className="option-item">
                                    {option.option_text || 'N/A'}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Student's Answer */}
                          {showAnswer && (
                            <div className="student-answer-section">
                              <div className="answer-content-inline">
                                <span className="section-label-inline">{t('studentExams.results.yourAnswer')}</span>
                                <span className="answer-value">
                                  {(() => {
                                    // Parse selected_options nếu là string
                                    let parsedSelectedOptions = answer.selected_options;
                                    if (parsedSelectedOptions && typeof parsedSelectedOptions === 'string') {
                                      try {
                                        parsedSelectedOptions = JSON.parse(parsedSelectedOptions);
                                      } catch (e) {
                                        // Nếu parse thất bại, giữ nguyên
                                      }
                                    }

                                    // Nếu parsedSelectedOptions là object có cấu trúc {options, selected_at}, extract options
                                    if (parsedSelectedOptions && typeof parsedSelectedOptions === 'object' && !Array.isArray(parsedSelectedOptions)) {
                                      if (parsedSelectedOptions.options) {
                                        parsedSelectedOptions = parsedSelectedOptions.options;
                                      } else if (parsedSelectedOptions.selected_at && !parsedSelectedOptions.options) {
                                        // Nếu chỉ có selected_at mà không có options (text answer)
                                        parsedSelectedOptions = null;
                                      }
                                    }

                                    const hasAnswer = parsedSelectedOptions || (answer.answer_text && answer.answer_text.trim() !== '');
                                    if (!hasAnswer) {
                                      return <span className="answer-empty">{t('studentExams.results.notAnswered')}</span>;
                                    }

                                    // Hiển thị đáp án đã chọn - chỉ nội dung, in đậm
                                    if (answer.question_type === 'mcq' || answer.question_type === 'multiple_choice' || answer.question_type === 'multiple_response') {
                                      if (!parsedSelectedOptions || (Array.isArray(parsedSelectedOptions) && parsedSelectedOptions.length === 0)) {
                                        return <span className="answer-empty">{t('studentExams.results.notAnswered')}</span>;
                                      }

                                      // Tìm và hiển thị các options đã chọn
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

                                      // Fallback: hiển thị ID nếu không tìm thấy option
                                      const displayValue = Array.isArray(parsedSelectedOptions)
                                        ? parsedSelectedOptions.join(', ')
                                        : (parsedSelectedOptions && typeof parsedSelectedOptions !== 'object' ? String(parsedSelectedOptions) : t('studentExams.results.notAnswered'));
                                      return <span className="answer-option-selected">{displayValue}</span>;
                                    } else if (answer.question_type === 'true_false') {
                                      if (answer.answer_text === 'true') {
                                        return <span className="answer-option-selected">{t('studentExams.examTaking.true')}</span>;
                                      } else if (answer.answer_text === 'false') {
                                        return <span className="answer-option-selected">{t('studentExams.examTaking.false')}</span>;
                                      } else {
                                        return <span className="answer-empty">{t('studentExams.results.notAnswered')}</span>;
                                      }
                                    } else {
                                      // Short answer, essay, etc.
                                      return <span className="answer-option-selected">{answer.answer_text || t('studentExams.results.notAnswered')}</span>;
                                    }
                                  })()}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Timestamp */}
                          {showTimestamp && (
                            <div className="answer-timestamp">
                              <i className="fas fa-clock"></i>
                              <span>{t('studentExams.results.selectedAt')} {new Date(answerTimestamp).toLocaleString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}</span>
                            </div>
                          )}
                        </div>
                      );
                    });
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="text-center">
              <button
                className="create-session-btn"
                onClick={() => {
                  setShowResults(false);
                  setResults(null);
                  setSelectedExam(null);
                  // Restart auto-refresh when returning to list
                  startAutoRefresh();
                }}
              >
                <i className="fas fa-arrow-left me-2"></i>{t('studentExams.actions.backToList')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main exam list view
  return (
    <div className="container-fluid session-main-container">
      {/* Show overlay if regulation modal is open */}
      {showRegulationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1040,
          pointerEvents: 'none'
        }} />
      )}
      
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
                <h1>{t('studentExams.headerTitle')}</h1>
            <p className="header-subtitle">{t('studentExams.headerSubtitle')}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">{t('studentExams.loading')}</span>
          </div>
        </div>
      ) : exams.length === 0 ? (
        <Card>
          <Card.Body className="text-center p-5">
            <i className="fas fa-clipboard-list fa-3x text-muted mb-3"></i>
            <p className="text-muted">{t('studentExams.noExams')}</p>
          </Card.Body>
        </Card>
      ) : (
        <div className="session-table-container">
          <table className="session-table">
            <thead>
              <tr>
                <th>{t('studentExams.tableHeaders.name')}</th>
                <th>{t('studentExams.tableHeaders.type')}</th>
                <th>{t('studentExams.tableHeaders.timeRange')}</th>
                <th>{t('studentExams.tableHeaders.duration')}</th>
                <th>{t('studentExams.tableHeaders.score')}</th>
                <th>{t('studentExams.tableHeaders.completed')}</th>
                <th>{t('studentExams.tableHeaders.status')}</th>
                <th>{t('studentExams.tableHeaders.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => {
                // Kiểm tra nếu exam đang mở (badge success) để thêm class animation
                const now = new Date();
                const start = exam.available_from ? new Date(exam.available_from) :
                  (exam.scheduled_start ? new Date(exam.scheduled_start) : null);
                const end = exam.available_until ? new Date(exam.available_until) :
                  (exam.scheduled_end ? new Date(exam.scheduled_end) : null);
                const isApproved = exam.is_approved === 1 || exam.is_approved === true;
                const isLive = isApproved && start && now >= start && (!end || now <= end);
                // Kiểm tra xem kỳ thi đã kết thúc chưa
                const isExamEnded = end && now > end;

                return (
                  <tr key={exam.exam_id} className={isLive ? 'live-exam-row' : ''}>
                    <td>
                      <strong>{exam.exam_title}</strong>
                      {exam.exam_description && (
                        <div className="text-muted small">{exam.exam_description}</div>
                      )}
                    </td>
                    <td>{getTypeBadge(exam.exam_type)}</td>
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
                    <td>{t('studentExams.examInfo.minutes', { minutes: exam.duration_minutes || 0 })}</td>
                    <td>
                      {exam.best_score !== null && exam.best_score !== undefined ? (
                        (() => {
                          // Calculate percentage: (best_score / total_points) * 100
                          const percentage = exam.total_points > 0 ? (exam.best_score / exam.total_points) * 100 : 0;
                          // Compare percentage with passing_score (passing_score is already a percentage, e.g., 60 means 60%)
                          const passed = percentage >= (exam.passing_score || 0);
                          return (
                            <Badge
                              bg={passed ? 'success' : 'danger'}
                              title={passed ? 'Đạt' : 'Không đạt'}
                              style={{ cursor: 'help' }}
                            >
                              {formatNumber(exam.best_score)} / {formatNumber(exam.total_points)}
                            </Badge>
                          );
                        })()
                      ) : (
                        <span className="text-muted">{t('studentExams.completed.notCompleted')}</span>
                      )}
                    </td>
                    <td>
                      {exam.time_spent_seconds !== null && exam.time_spent_seconds !== undefined ? (
                        <div>
                          <strong>{formatTimeSpent(exam.time_spent_seconds)}</strong>
                        </div>
                      ) : exam.best_score !== null && exam.best_score !== undefined ? (
                        <span className="text-muted">
                          <i className="fas fa-check-circle me-1 text-success"></i>
                          {t('studentExams.completed.completed')}
                        </span>
                      ) : exam.attempts_count > 0 ? (
                        <span className="text-muted">
                          <i className="fas fa-clock me-1 text-warning"></i>
                        </span>
                      ) : (
                        <span className="text-muted">
                          {t('studentExams.completed.notCompleted')}
                        </span>
                      )}
                    </td>
                    <td>{getStatusBadge(exam)}</td>
                    <td>
                      <button
                        className="shimmer-button group"
                        onClick={() => handleStartExam(exam)}
                        disabled={!exam.is_approved || isExamEnded}
                        style={{
                          '--spread': '90deg',
                          '--shimmer-color': '#ffffff',
                          '--radius': '15px',
                          '--speed': '1.5s',
                          '--cut': '2px',
                          '--bg': 'radial-gradient(ellipse 80% 50% at 50% 120%, #256176, #256176)'
                        }}
                      >
                        {/* Shimmer effect - visible by default */}
                        <div className="shimmer-button-overlay">
                          <div className="shimmer-button-gradient">
                            <div className="shimmer-button-shine"></div>
                          </div>
                        </div>
                        <div className="shimmer-button-inner"></div>

                        {/* Hover fill effect */}
                        <span className="shimmer-button-fill"></span>

                        {/* Icon arrow - slides in on hover */}
                        <span className="shimmer-button-icon">
                          <i className="fas fa-arrow-right"></i>
                        </span>

                        {/* Button text */}
                        <span className="shimmer-button-text">
                          {t('studentExams.actions.startExam')}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Start Exam Confirmation Modal */}
      <Modal show={showStartModal} onHide={() => {
        setShowStartModal(false);
        setExamPassword('');
        setPasswordError('');
        setRequiresPassword(false);
        setWebcamModalError('');
        // Restart auto-refresh when closing modal without starting exam
        if (!currentAttempt) {
          startAutoRefresh();
        }
      }} size="lg" className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-clipboard-check"></i>
            </div>
            <div>
              <h4 className="mb-0">{t('studentExams.startModal.title')}</h4>
              <p className="mb-0 student-subtitle">{selectedExam?.exam_title || t('studentExams.startModal.subtitle')}</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
            {/* Exam Information Card */}
            <div className="session-card mb-4">
              <div className="card-header-modern">
                <div className="header-icon">
                  <i className="fas fa-info-circle"></i>
                </div>
                <h6 className="mb-0">{t('studentExams.startModal.examInfoTitle')}</h6>
              </div>



              <div className="card-body-modern">
                <div className="info-item">
                  <div className="info-label">
                    <i className="fas fa-clock me-2"></i>
                    {t('studentExams.examInfo.duration')}
                  </div>
                  <div className="info-value">
                    <Badge bg="primary" className="fs-6">
                      {t('studentExams.examInfo.minutes', { minutes: selectedExam?.duration_minutes || 0 })}
                    </Badge>
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">
                    <i className="fas fa-star me-2"></i>
                    {t('studentExams.examInfo.totalPoints')}
                  </div>
                  <div className="info-value">
                    <Badge bg="success" className="fs-6">
                      {t('studentExams.examInfo.points', { points: formatNumber(selectedExam?.total_points || 0) })}
                    </Badge>
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">
                    <i className="fas fa-check-circle me-2"></i>
                    {t('studentExams.examInfo.passingScore')}
                  </div>
                  <div className="info-value">
                    <Badge bg="warning" className="fs-6">
                      {Math.round(selectedExam?.passing_score || 0)}{t('studentExams.examInfo.percent')}
                    </Badge>
                  </div>
                </div>
                {selectedExam?.exam_type && (
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-tag me-2"></i>
                      {t('studentExams.examInfo.examType')}
                    </div>
                    <div className="info-value">
                      <Badge bg="info" className="fs-6">
                        {selectedExam.exam_type === 'midterm' ? t('studentExams.types.midterm') :
                          selectedExam.exam_type === 'final' ? t('studentExams.types.final') :
                            selectedExam.exam_type === 'quiz' ? t('studentExams.types.quiz') :
                              selectedExam.exam_type === 'assignment' ? t('studentExams.types.practice') :
                                selectedExam.exam_type}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Webcam error - show separately from password */}
            {webcamModalError && (
              <Alert variant="danger" className="mb-4">
                <div className="d-flex align-items-center">
                  <i className="fas fa-video me-3"></i>
                  <div>
                    <strong>{t('studentExams.startModal.webcamError')}</strong> {webcamModalError}
                  </div>
                </div>
              </Alert>
            )}

            {/* Password input if required (only show if not webcam error) */}
            {!webcamModalError && (requiresPassword || selectedExam?.exam_password) && (
              <div className="session-card mb-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-key"></i>
                  </div>
                  <h6 className="mb-0">{t('studentExams.startModal.passwordTitle')}</h6>
                </div>
                <div className="card-body-modern">
                  <Form.Group className="mb-3">
                    <Form.Label className="info-label">
                      <i className="fas fa-lock me-2"></i>
                      {t('studentExams.startModal.passwordLabel')} <span className="text-danger">{t('studentExams.startModal.passwordRequired')}</span>
                    </Form.Label>
                    <Form.Control
                      type="password"
                      placeholder={t('studentExams.startModal.passwordPlaceholder')}
                      value={examPassword}
                      onChange={(e) => {
                        setExamPassword(e.target.value);
                        setPasswordError('');
                      }}
                      isInvalid={!!passwordError}
                      className="form-control-modern"
                    />
                    {passwordError && (
                      <Form.Control.Feedback type="invalid">
                        {passwordError}
                      </Form.Control.Feedback>
                    )}
                    <Form.Text className="text-muted">
                      <i className="fas fa-info-circle me-1"></i>
                      {t('studentExams.startModal.passwordHelp')}
                    </Form.Text>
                  </Form.Group>
                </div>
              </div>
            )}

            {/* IMS EXAM PCTU Download Section */}
            {(selectedExam?.ims_exam_pctu_required === true || selectedExam?.ims_exam_pctu_required === 1) && (
              <div className="session-card mb-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-download"></i>
                  </div>
                  <h6 className="mb-0">{t('studentExams.startModal.imsExamPctuTitle')}</h6>
                </div>
                <div className="card-body-modern">
                  <div className="modern-alert modern-alert-info mb-4">
                    <div className="d-flex align-items-start">
                      <i className="fas fa-info-circle mt-1 me-2"></i>
                      <div>
                        <h6 className="fw-bold mb-2">{t('studentExams.startModal.imsExamPctuInfo')}</h6>
                      </div>
                    </div>
                  </div>
                  
                  {loadingFiles ? (
                    <div className="text-center py-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      <span>{t('studentExams.startModal.loadingFiles')}</span>
                    </div>
                  ) : imsExamPctuFiles.length > 0 ? (
                    <>
                      {/* Header với số lượng file */}
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <h6 className="fw-bold mb-0">
                          <i className="fas fa-folder-open me-2 text-primary"></i>
                          {t('studentExams.startModal.versions')}
                        </h6>
                        <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2">
                          {t('studentExams.startModal.versionCount', { count: imsExamPctuFiles.length })}
                        </span>
                      </div>
                      
                      <div className="file-grid">
                        {imsExamPctuFiles.map((file, index) => (
                          <div key={index} className="file-card">
                            {/* File header */}
                            <div className="file-header">
                              <div className="file-icon">
                                <i className="fas fa-file-download text-white"></i>
                              </div>
                              <div className="file-actions">
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  title={t('studentExams.startModal.download')}
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    // #region agent log
                                    fetch('http://127.0.0.1:7242/ingest/2089b47a-5a22-45c6-a7dc-d1cf43a51708',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StudentExams.js:3477',message:'Download started',data:{fileName:file.name,fileUrl:file.downloadUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                                    // #endregion
                                    
                                    try {
                                      const token = localStorage.getItem('token');
                                      const fileUrl = `${window.location.origin}${file.downloadUrl}`;
                                      
                                      // #region agent log
                                      fetch('http://127.0.0.1:7242/ingest/2089b47a-5a22-45c6-a7dc-d1cf43a51708',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StudentExams.js:3486',message:'Fetch request initiated',data:{fileUrl,hasToken:!!token,tokenLength:token?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                                      // #endregion
                                      
                                      // Fetch file with authentication, then create blob URL for download
                                      // Add timeout and better error handling for large files
                                      const controller = new AbortController();
                                      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
                                      
                                      const response = await fetch(fileUrl, {
                                        method: 'GET',
                                        headers: {
                                          'x-auth-token': token || ''
                                        },
                                        signal: controller.signal
                                      });
                                      
                                      clearTimeout(timeoutId);
                                      
                                      // #region agent log
                                      console.log('[DOWNLOAD] Response received:', {
                                        status: response.status,
                                        statusText: response.statusText,
                                        ok: response.ok,
                                        contentType: response.headers.get('content-type'),
                                        contentLength: response.headers.get('content-length')
                                      });
                                      // #endregion
                                      
                                      // Accept both 200 and 206 status codes
                                      if (!response.ok && response.status !== 200 && response.status !== 206) {
                                        // #region agent log
                                        fetch('http://127.0.0.1:7242/ingest/2089b47a-5a22-45c6-a7dc-d1cf43a51708',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StudentExams.js:3497',message:'Response status check failed',data:{status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                                        // #endregion
                                        throw new Error(t('studentExams.errors.cannotLoadFile', { status: response.status }));
                                      }
                                      
                                      // #region agent log
                                      console.log('[DOWNLOAD] Starting blob creation...');
                                      // #endregion
                                      
                                      // Get blob from response (works with both 200 and 206)
                                      // For large files, this may take time - track progress
                                      const reader = response.body.getReader();
                                      const chunks = [];
                                      let receivedLength = 0;
                                      
                                      while (true) {
                                        const { done, value } = await reader.read();
                                        if (done) break;
                                        chunks.push(value);
                                        receivedLength += value.length;
                                        
                                        // Log progress every 10MB
                                        if (receivedLength % (10 * 1024 * 1024) < value.length) {
                                          console.log(`[DOWNLOAD] Progress: ${(receivedLength / 1024 / 1024).toFixed(2)} MB`);
                                        }
                                      }
                                      
                                      // Combine all chunks into a single blob
                                      const blob = new Blob(chunks);
                                      
                                      // #region agent log
                                      console.log('[DOWNLOAD] Blob created:', {
                                        blobSize: blob.size,
                                        blobType: blob.type,
                                        receivedLength
                                      });
                                      // #endregion
                                      
                                      const blobUrl = URL.createObjectURL(blob);
                                      
                                      // #region agent log
                                      fetch('http://127.0.0.1:7242/ingest/2089b47a-5a22-45c6-a7dc-d1cf43a51708',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StudentExams.js:3508',message:'Blob URL created',data:{blobUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                                      // #endregion
                                      
                                      // Create download link
                                      const link = document.createElement('a');
                                      link.href = blobUrl;
                                      link.download = file.name;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      
                                      // #region agent log
                                      fetch('http://127.0.0.1:7242/ingest/2089b47a-5a22-45c6-a7dc-d1cf43a51708',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StudentExams.js:3516',message:'Download link clicked',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                                      // #endregion
                                      
                                      // Clean up blob URL
                                      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                                      showAlert(t('studentExams.success.fileDownloading'), 'success');
                                    } catch (error) {
                                      // #region agent log
                                      fetch('http://127.0.0.1:7242/ingest/2089b47a-5a22-45c6-a7dc-d1cf43a51708',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StudentExams.js:3522',message:'Error caught',data:{errorName:error.name,errorMessage:error.message,errorStack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
                                      // #endregion
                                      console.error('Lỗi khi tải file:', error);
                                      showAlert(error.message || t('studentExams.errors.downloadError'), 'danger');
                                    }
                                  }}
                                >
                                  <i className="fas fa-download"></i>
                                </button>
                              </div>
                            </div>
                            
                            {/* File info */}
                            <div className="file-info-container file-info-visible">
                              <div className="file-info">
                                <div className="file-name">
                                  {file.label}
                                  <Badge bg="secondary" className="ms-2">{file.arch}</Badge>
                                </div>
                                
                                <div className="file-meta">
                                  <span className="file-size">
                                    <i className="fas fa-weight me-1"></i>
                                    {file.sizeMB} MB
                                  </span>
                                  <span className="file-date">
                                    <i className="fas fa-clock me-1"></i>
                                    {file.lastModifiedFormatted}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-muted p-4">
                      <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{width: '60px', height: '60px'}}>
                        <i className="fas fa-exclamation-triangle fa-2x text-muted"></i>
                      </div>
                      <p className="mb-0">{t('studentExams.startModal.noFiles')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Alert variant="warning" className="mb-0">
              <div className="d-flex align-items-center">
                <i className="fas fa-exclamation-triangle me-3"></i>
                <div>
                  <strong>{t('studentExams.startModal.importantNote')}</strong> {t('studentExams.startModal.importantNoteText')}
                </div>
              </div>
            </Alert>
          </div>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button
            variant="outline-secondary"
            onClick={() => {
              setShowStartModal(false);
              setExamPassword('');
              setPasswordError('');
              setRequiresPassword(false);
              setWebcamModalError('');
              // Restart auto-refresh when canceling
              if (!currentAttempt) {
                startAutoRefresh();
              }
            }}
            className="btn-cancel"
          >
            <i className="fas fa-times me-2"></i>
            {t('studentExams.actions.cancel')}
          </Button>
          <button
            className="shimmer-button group"
            onClick={confirmStartExam}
            style={{
              '--spread': '90deg',
              '--shimmer-color': '#ffffff',
              '--radius': '15px',
              '--speed': '1.5s',
              '--cut': '2px',
              '--bg': 'radial-gradient(ellipse 80% 50% at 50% 120%, #256176, #256176)'
            }}
          >
            {/* Shimmer effect - visible by default */}
            <div className="shimmer-button-overlay">
              <div className="shimmer-button-gradient">
                <div className="shimmer-button-shine"></div>
              </div>
            </div>
            <div className="shimmer-button-inner"></div>

            {/* Hover fill effect */}
            <span className="shimmer-button-fill"></span>

            {/* Icon arrow - slides in on hover */}
            <span className="shimmer-button-icon">
              <i className="fas fa-arrow-right"></i>
            </span>

            {/* Button text */}
            <span className="shimmer-button-text">
              {t('studentExams.actions.confirmStart')}
            </span>
          </button>
        </Modal.Footer>
      </Modal>

      {/* Face Verification Modal */}
      <FaceVerificationModal
        show={showFaceVerificationModal}
        onHide={() => setShowFaceVerificationModal(false)}
        onSuccess={handleFaceVerificationSuccess}
        onError={(error) => {
          console.error('Face verification error:', error);
        }}
        api={api}
        maxAttempts={2}
        retryTimeout={5000}
        successMessage={t('studentExams.faceVerificationMessages.success')}
        errorMessage={t('studentExams.faceVerificationMessages.failed')}
        showRetryCountdown={true}
        context="exam"
      />

      {/* Face Sample Required Modal */}
      <Modal
        show={showFaceSampleRequiredModal}
        onHide={() => setShowFaceSampleRequiredModal(false)}
        centered
        size="md"
        className="face-verification-modal"
      >
        <Modal.Body className="face-verification-body">
          <div className="face-verification-container">
            <div className="session-card">
              <div className="card-body-modern text-center py-4">
                <div className="rounded-circle bg-warning bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-4" style={{ width: '100px', height: '100px' }}>
                  <User size={50} className="text-warning" />
                </div>
                <h5 className="mb-3" style={{ fontSize: '18px', fontWeight: '600', color: '#495057' }}>
                  {t('studentExams.faceVerification.noFaceSample')}
                </h5>
                <p className="text-muted mb-0" style={{ fontSize: '15px', lineHeight: '1.6' }}>
                  {t('studentExams.faceVerification.description')}
                </p>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="face-verification-footer">
          <Button
            variant="outline-secondary"
            onClick={() => setShowFaceSampleRequiredModal(false)}
            className="face-verification-btn-cancel"
          >
            <i className="fas fa-times me-2"></i>
            {t('studentExams.actions.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setShowFaceSampleRequiredModal(false);
              navigate('/profile');
            }}
            className="face-verification-btn-primary"
          >
            <User size={18} className="me-2" />
            {t('studentExams.faceVerification.register')}
          </Button>
        </Modal.Footer>
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
            <h4 className="mb-0">{examRegulation?.title || t('studentExams.regulation.title')}</h4>
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
                      {t('studentExams.regulation.confirm')}
                    </>
                  ) : (
                    <>
                      <i className="fas fa-clock me-2"></i>
                      {t('studentExams.regulation.pleaseRead')}
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

export default StudentExams;

// Add CSS for file grid layout (same style as MonitoringPage)
const fileGridStyle = document.createElement('style');
fileGridStyle.textContent = `
  /* File Grid Layout */
  .file-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .file-card {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    padding: 1rem;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  
  .file-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
    border-color: #007bff;
  }
  
  .file-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  
  .file-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #007bff, #0056b3);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.2rem;
  }
  
  .file-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .file-actions .btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }
  
  .file-info {
    space-y: 0.5rem;
  }
  
  .file-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: #2c3e50;
    margin-bottom: 0.5rem;
    word-break: break-word;
  }
  
  .file-meta {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }
  
  .file-size, .file-date {
    font-size: 0.8rem;
    color: #6c757d;
    display: flex;
    align-items: center;
  }
  
  .file-info-container {
    overflow: hidden;
    transition: all 0.3s ease-in-out;
  }
  
  .file-info-container.file-info-visible {
    max-height: 200px;
    opacity: 1;
    transform: translateY(0);
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .file-grid {
      grid-template-columns: 1fr;
    }
    
    .file-meta {
      flex-direction: column;
      gap: 0.25rem;
    }
  }
`;
if (!document.head.querySelector('style[data-file-grid]')) {
  fileGridStyle.setAttribute('data-file-grid', 'true');
  document.head.appendChild(fileGridStyle);
}

