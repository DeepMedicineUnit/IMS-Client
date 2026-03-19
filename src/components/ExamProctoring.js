import React, { useEffect, useRef, useState } from 'react';
import { Alert, Badge } from 'react-bootstrap';
import axios from 'axios';

/**
 * Exam Proctoring Component
 * Giám sát thi trực tuyến với webcam và phát hiện gian lận
 * 
 * Tính năng:
 * - Hiển thị webcam sinh viên (ảnh snapshot do trang thi gửi)
 * - Phát hiện Page Visibility (chuyển tab, ẩn/hiện cửa sổ)
 * - Phát hiện Window Focus/Blur (mất focus)
 * - Phát hiện BeforeUnload (thoát trang, reload)
 * - Tự động cảnh báo các hành vi bất thường
 */
const ExamProctoring = ({ attemptId, examId, enabled = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [cheatingEvents, setCheatingEvents] = useState([]);
  const [webcamError, setWebcamError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  const videoRef = useRef(null);
  const visibilityTimeoutRef = useRef(null);
  const lastVisibilityChangeRef = useRef(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    if (!enabled || !attemptId) return;

    // Start webcam recording
    startWebcamRecording();

    // Setup cheating detection
    setupCheatingDetection();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, [enabled, attemptId]);

  const startWebcamRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsRecording(true);

    } catch (error) {
      console.error('Error accessing webcam:', error);
      setWebcamError('Không thể truy cập webcam. Vui lòng kiểm tra quyền truy cập.');
      logCheatingEvent('webcam_error', {
        error: error.message,
        error_name: error.name
      }, 'high', 'Không thể truy cập webcam');
    }
  };

  const setupCheatingDetection = () => {
    // 1. Page Visibility API - Phát hiện chuyển tab, ẩn/hiện cửa sổ
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 2. Window Focus/Blur - Phát hiện mất focus
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);

    // 3. BeforeUnload - Phát hiện thoát trang, reload
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 4. Context menu - Ngăn chuột phải
    document.addEventListener('contextmenu', handleContextMenu);

    // 5. Keyboard shortcuts - Ngăn một số phím tắt
    document.addEventListener('keydown', handleKeyDown);
  };

  const handleVisibilityChange = () => {
    const isHidden = document.hidden;

    if (isHidden) {
      // Tab/window bị ẩn
      const now = Date.now();
      lastVisibilityChangeRef.current = now;

      // Log sau 2 giây nếu vẫn bị ẩn
      visibilityTimeoutRef.current = setTimeout(() => {
        if (document.hidden) {
          logCheatingEvent('page_visibility', {
            hidden: true,
            timestamp: new Date().toISOString()
          }, 'high', 'Người dùng đã chuyển tab hoặc ẩn cửa sổ trình duyệt');

          addWarning('Cảnh báo: Bạn đã chuyển tab hoặc ẩn cửa sổ. Hành vi này đã được ghi lại.');
        }
      }, 2000);
    } else {
      // Tab/window được hiển thị lại
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }

      if (lastVisibilityChangeRef.current) {
        const hiddenDuration = Date.now() - lastVisibilityChangeRef.current;
        
        if (hiddenDuration > 2000) {
          logCheatingEvent('page_visibility', {
            hidden: false,
            duration: hiddenDuration,
            timestamp: new Date().toISOString()
          }, 'medium', `Người dùng quay lại sau ${Math.round(hiddenDuration / 1000)} giây`);
        }
      }
    }
  };

  const handleWindowBlur = () => {
    logCheatingEvent('window_blur', {
      timestamp: new Date().toISOString()
    }, 'medium', 'Cửa sổ trình duyệt mất focus');

    addWarning('Cảnh báo: Cửa sổ trình duyệt đã mất focus. Hành vi này đã được ghi lại.');
  };

  const handleWindowFocus = () => {
    logCheatingEvent('window_focus', {
      timestamp: new Date().toISOString()
    }, 'low', 'Cửa sổ trình duyệt được focus lại');
  };

  const handleBeforeUnload = (e) => {
    // Log sự kiện
    logCheatingEvent('before_unload', {
      timestamp: new Date().toISOString()
    }, 'high', 'Người dùng cố gắng thoát trang hoặc reload');

    // Hiển thị cảnh báo
    e.preventDefault();
    e.returnValue = 'Bạn có chắc chắn muốn thoát? Hành vi này sẽ được ghi lại.';
    return e.returnValue;
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    logCheatingEvent('context_menu', {
      timestamp: new Date().toISOString()
    }, 'low', 'Người dùng cố gắng mở menu chuột phải');
  };

  const handleKeyDown = (e) => {
    // Ngăn một số phím tắt
    const blockedKeys = [
      'F12', // Developer tools
      'F5', // Refresh
      'Ctrl+R', // Refresh
      'Ctrl+Shift+I', // Developer tools
      'Ctrl+Shift+J', // Console
      'Ctrl+U', // View source
      'Ctrl+S', // Save
      'Ctrl+P' // Print
    ];

    const keyCombo = `${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`;

    if (blockedKeys.includes(keyCombo) || blockedKeys.includes(e.key)) {
      e.preventDefault();
      logCheatingEvent('blocked_key', {
        key: e.key,
        keyCombo,
        timestamp: new Date().toISOString()
      }, 'medium', `Phím tắt bị chặn: ${keyCombo}`);

      addWarning(`Cảnh báo: Phím tắt ${keyCombo} đã bị chặn.`);
    }
  };

  const logCheatingEvent = async (eventType, eventData, severity = 'medium', description = '') => {
    try {
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API_BASE_URL}/lms/attempts/${attemptId}/cheating-logs`,
        {
          event_type: eventType,
          event_data: eventData,
          severity,
          description
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Add to local state
      setCheatingEvents(prev => [...prev, {
        event_type: eventType,
        severity,
        description,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error logging cheating event:', error);
    }
  };

  const addWarning = (message) => {
    setWarnings(prev => [...prev, {
      message,
      timestamp: new Date()
    }]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setWarnings(prev => prev.slice(1));
    }, 5000);
  };

  const cleanup = () => {
    // Stop stream
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }

    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current);
    }

    // Remove event listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleWindowFocus);
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('keydown', handleKeyDown);
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className="exam-proctoring-container" style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      {/* Webcam Preview */}
      <div className="webcam-preview" style={{
        background: '#000',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: '100%',
            height: 'auto',
            display: isRecording ? 'block' : 'none'
          }}
        />
        {!isRecording && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#fff'
          }}>
            <i className="fas fa-video fa-2x mb-2"></i>
            <div>Đang khởi động webcam...</div>
          </div>
        )}
        {webcamError && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#dc3545'
          }}>
            <i className="fas fa-exclamation-triangle fa-2x mb-2"></i>
            <div>{webcamError}</div>
          </div>
        )}
      </div>

      {/* Status Indicator */}
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        padding: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '10px'
      }}>
        <div className="d-flex align-items-center justify-content-between">
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Trạng thái giám sát:</span>
          <Badge bg={isRecording ? 'success' : 'danger'}>
            {isRecording ? (
              <>
                <i className="fas fa-circle" style={{ fontSize: '8px', marginRight: '4px' }}></i>
                Đang ghi
              </>
            ) : (
              'Tạm dừng'
            )}
          </Badge>
        </div>
        {cheatingEvents.length > 0 && (
          <div className="mt-2" style={{ fontSize: '11px', color: '#dc3545' }}>
            <i className="fas fa-exclamation-triangle me-1"></i>
            {cheatingEvents.length} sự kiện đã được ghi lại
          </div>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div>
          {warnings.map((warning, index) => (
            <Alert
              key={index}
              variant="warning"
              style={{
                fontSize: '12px',
                padding: '8px 12px',
                marginBottom: '8px'
              }}
            >
              <i className="fas fa-exclamation-triangle me-2"></i>
              {warning.message}
            </Alert>
          ))}
        </div>
      )}

      {/* Info */}
      <div style={{
        background: '#f8f9fa',
        borderRadius: '8px',
        padding: '10px',
        fontSize: '11px',
        color: '#6c757d'
      }}>
        <div className="mb-1">
          <i className="fas fa-shield-alt me-1"></i>
          <strong>Giám sát đang hoạt động</strong>
        </div>
        <div className="small">
          • Webcam đang ghi lại<br />
          • Phát hiện chuyển tab<br />
          • Phát hiện mất focus<br />
          • Ghi log tự động
        </div>
      </div>
    </div>
  );
};

export default ExamProctoring;

