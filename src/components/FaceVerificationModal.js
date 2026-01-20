import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Spinner, ProgressBar, Alert } from 'react-bootstrap';
import { Camera, CheckCircle, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const FaceVerificationModal = ({
  show,
  onHide,
  onSuccess,
  onError,
  onCancel,
  api: customApi,
  maxAttempts = 2,
  retryTimeout = 5000,
  successMessage = 'Xác minh thành công!',
  errorMessage = 'Xác minh thất bại',
  showRetryCountdown = true,
  context = 'exam' // 'exam', 'attendance', 'profile'
}) => {
  const { api: authApi } = useAuth();
  const api = customApi || authApi;

  // Face verification states
  const [faceVerificationStep, setFaceVerificationStep] = useState('preview'); // 'preview', 'liveness', 'action', 'capturing', 'verifying', 'success', 'error', 'retry'
  const [faceVerificationProgress, setFaceVerificationProgress] = useState(0);
  const [faceVerificationMessage, setFaceVerificationMessage] = useState('');
  const [faceVerificationAttempt, setFaceVerificationAttempt] = useState(0);
  const [livenessStep, setLivenessStep] = useState(1); // 1: liveness, 2: action, 3: face detection, 4: face recognition
  const [previousFrame, setPreviousFrame] = useState(null);
  const [detectedBbox, setDetectedBbox] = useState(null);
  const [detectedLandmarks, setDetectedLandmarks] = useState(null);
  const [faceVerificationCountdown, setFaceVerificationCountdown] = useState(0);
  const [faceVerificationRetryTimeout, setFaceVerificationRetryTimeout] = useState(null);

  // Refs
  const faceVerificationVideoRef = useRef(null);
  const faceVerificationCanvasRef = useRef(null);
  const faceVerificationOverlayCanvasRef = useRef(null);
  const faceVerificationStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const previewDetectionIntervalRef = useRef(null);
  const detectionAbortControllerRef = useRef(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (show) {
      setFaceVerificationStep('preview');
      setFaceVerificationProgress(0);
      setFaceVerificationMessage('');
      setFaceVerificationAttempt(0);
      setLivenessStep(1);
      setPreviousFrame(null);
      setDetectedBbox(null);
      setDetectedLandmarks(null);
      setFaceVerificationCountdown(0);
    } else {
      closeFaceVerificationModal();
    }
  }, [show]);

  // Start face verification camera
  const startFaceVerificationCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setFaceVerificationStep('error');
        setFaceVerificationMessage('Trình duyệt không hỗ trợ truy cập camera. Vui lòng sử dụng trình duyệt khác (Chrome, Firefox, Edge).');
        throw new Error('getUserMedia not available');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }
      });

      if (faceVerificationVideoRef.current) {
        faceVerificationVideoRef.current.srcObject = stream;
        faceVerificationStreamRef.current = stream;
        setFaceVerificationStep('preview');
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setFaceVerificationStep('error');
      
      let errorMessage = 'Không thể truy cập camera. ';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Quyền truy cập camera bị từ chối. Vui lòng:\n' +
          '1. Click vào biểu tượng khóa ở thanh địa chỉ\n' +
          '2. Cho phép quyền truy cập camera\n' +
          '3. Làm mới trang và thử lại';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'Không tìm thấy camera. Vui lòng:\n' +
          '1. Kiểm tra camera đã được kết nối\n' +
          '2. Đảm bảo không có ứng dụng khác đang sử dụng camera\n' +
          '3. Thử lại sau';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Camera đang được sử dụng bởi ứng dụng khác. Vui lòng:\n' +
          '1. Đóng tất cả ứng dụng đang sử dụng camera (Zoom, Teams, Skype, v.v.)\n' +
          '2. Làm mới trang và thử lại\n' +
          '3. Nếu vẫn lỗi, khởi động lại trình duyệt';
      } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        errorMessage = 'Camera không hỗ trợ yêu cầu. Đang thử với cài đặt mặc định...';
        try {
          const defaultStream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
          if (faceVerificationVideoRef.current) {
            faceVerificationVideoRef.current.srcObject = defaultStream;
            faceVerificationStreamRef.current = defaultStream;
            setFaceVerificationStep('preview');
            return;
          }
        } catch (retryError) {
          errorMessage = 'Không thể truy cập camera với bất kỳ cài đặt nào. Vui lòng kiểm tra camera và thử lại.';
        }
      }
      
      setFaceVerificationMessage(errorMessage);
      if (onError) onError(error);
    }
  };

  // Stop face verification camera
  const stopFaceVerificationCamera = () => {
    if (faceVerificationStreamRef.current) {
      faceVerificationStreamRef.current.getTracks().forEach(track => track.stop());
      faceVerificationStreamRef.current = null;
    }
    if (faceVerificationVideoRef.current) {
      faceVerificationVideoRef.current.srcObject = null;
    }
  };

  // Helper function to capture frame from video
  const captureFrame = async () => {
    const video = faceVerificationVideoRef.current;
    const canvas = faceVerificationCanvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState < 2) {
      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
        video.onloadeddata = resolve;
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) return null;

    canvas.width = videoWidth;
    canvas.height = videoHeight;
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

    const imageBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Không thể tạo ảnh từ camera'));
      }, 'image/jpeg', 0.8);
    });

    const reader = new FileReader();
    const base64Image = await new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });

    return { base64Image, imageBlob };
  };

  // Draw detection boxes on overlay canvas
  const drawDetectionBoxes = () => {
    const overlayCanvas = faceVerificationOverlayCanvasRef.current;
    const video = faceVerificationVideoRef.current;
    
    if (!overlayCanvas || !video) return;
    
    // Get actual video native dimensions
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    if (videoWidth === 0 || videoHeight === 0) return;
    
    // Get display dimensions using getBoundingClientRect for accurate size
    const videoRect = video.getBoundingClientRect();
    const displayWidth = videoRect.width;
    const displayHeight = videoRect.height;
    
    if (displayWidth === 0 || displayHeight === 0) return;
    
    // Set canvas internal size to match display size (CSS handles the visual size)
    // This ensures 1:1 pixel mapping
    if (overlayCanvas.width !== displayWidth || overlayCanvas.height !== displayHeight) {
      overlayCanvas.width = displayWidth;
      overlayCanvas.height = displayHeight;
    }
    
    const ctx = overlayCanvas.getContext('2d');
    
    // Calculate scale factors from video native size to display size
    // Video element with width: 100% and height: auto will maintain aspect ratio
    // So we need to calculate the actual rendered video size within the container
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = displayWidth / displayHeight;
    
    let scaleX, scaleY;
    let offsetX = 0, offsetY = 0;
    let renderedVideoWidth, renderedVideoHeight;
    
    if (containerAspect > videoAspect) {
      // Container is wider than video - video will fit height, letterboxing on sides
      renderedVideoHeight = displayHeight;
      renderedVideoWidth = renderedVideoHeight * videoAspect;
      offsetX = (displayWidth - renderedVideoWidth) / 2;
      scaleX = renderedVideoWidth / videoWidth;
      scaleY = renderedVideoHeight / videoHeight;
    } else {
      // Container is taller than video - video will fit width, pillarboxing on top/bottom
      renderedVideoWidth = displayWidth;
      renderedVideoHeight = renderedVideoWidth / videoAspect;
      offsetY = (displayHeight - renderedVideoHeight) / 2;
      scaleX = renderedVideoWidth / videoWidth;
      scaleY = renderedVideoHeight / videoHeight;
    }
    
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    if (detectedBbox && Array.isArray(detectedBbox) && detectedBbox.length >= 4) {
      // Bbox coordinates are in video native size, scale to display size
      const [x1, y1, x2, y2] = detectedBbox;
      const x = x1 * scaleX + offsetX;
      const y = y1 * scaleY + offsetY;
      const width = (x2 - x1) * scaleX;
      const height = (y2 - y1) * scaleY;
      
      // Draw face box (green)
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
      ctx.fillRect(x, y - 20, 100, 18);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Arial';
      ctx.fillText('Khuôn mặt', x + 5, y - 7);
    }
    
    if ((detectedLandmarks || faceVerificationStep === 'action') && detectedBbox && Array.isArray(detectedBbox) && detectedBbox.length >= 4) {
      const [x1, y1, x2, y2] = detectedBbox;
      const faceWidth = (x2 - x1) * scaleX;
      const faceHeight = (y2 - y1) * scaleY;
      const faceX = x1 * scaleX + offsetX;
      const faceY = y1 * scaleY + offsetY;
      
      // Draw left eye
      const leftEyeX = faceX + faceWidth * 0.2;
      const leftEyeY = faceY + faceHeight * 0.25;
      const eyeWidth = faceWidth * 0.15;
      const eyeHeight = faceHeight * 0.1;
      
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(leftEyeX, leftEyeY, eyeWidth, eyeHeight);
      
      ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
      ctx.fillRect(leftEyeX, leftEyeY - 18, 70, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px Arial';
      ctx.fillText('Mắt trái', leftEyeX + 3, leftEyeY - 5);
      
      // Draw right eye
      const rightEyeX = faceX + faceWidth * 0.65;
      const rightEyeY = faceY + faceHeight * 0.25;
      
      ctx.strokeRect(rightEyeX, rightEyeY, eyeWidth, eyeHeight);
      
      ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
      ctx.fillRect(rightEyeX, rightEyeY - 18, 70, 16);
      ctx.fillText('Mắt phải', rightEyeX + 3, rightEyeY - 5);
      
      // Draw mouth
      const mouthX = faceX + faceWidth * 0.3;
      const mouthY = faceY + faceHeight * 0.6;
      const mouthWidth = faceWidth * 0.4;
      const mouthHeight = faceHeight * 0.15;
      
      ctx.strokeStyle = '#ff00ff';
      ctx.strokeRect(mouthX, mouthY, mouthWidth, mouthHeight);
      
      ctx.fillStyle = 'rgba(255, 0, 255, 0.7)';
      ctx.fillRect(mouthX, mouthY - 18, 50, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Miệng', mouthX + 3, mouthY - 5);
    }
  };

  // Realtime face detection
  useEffect(() => {
    const stepsWithVideo = ['preview', 'liveness', 'action', 'capturing', 'verifying', 'retry'];
    
    if (!show || !stepsWithVideo.includes(faceVerificationStep)) {
      if (previewDetectionIntervalRef.current) {
        clearInterval(previewDetectionIntervalRef.current);
        previewDetectionIntervalRef.current = null;
      }
      return;
    }

    const detectFaceRealtime = async () => {
      try {
        const video = faceVerificationVideoRef.current;
        const canvas = faceVerificationCanvasRef.current;
        
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
          return;
        }

        if (detectionAbortControllerRef.current) {
          detectionAbortControllerRef.current.abort();
        }
        detectionAbortControllerRef.current = new AbortController();

        const ctx = canvas.getContext('2d');
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        if (videoWidth === 0 || videoHeight === 0) return;

        const maxWidth = 320;
        const scale = Math.min(1, maxWidth / videoWidth);
        const scaledWidth = Math.floor(videoWidth * scale);
        const scaledHeight = Math.floor(videoHeight * scale);

        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        ctx.drawImage(video, 0, 0, scaledWidth, scaledHeight);

        const imageBlob = await new Promise((resolve, reject) => {
          canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Không thể tạo ảnh'));
          }, 'image/jpeg', 0.5);
        });

        const reader = new FileReader();
        const base64Image = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(imageBlob);
        });

        const response = await api.post('/face-recognition/check-liveness', {
          image: base64Image
        }, {
          signal: detectionAbortControllerRef.current.signal,
          timeout: 2000
        });

        if (response.data.success && response.data.is_live && response.data.bbox) {
          const scaleX = videoWidth / scaledWidth;
          const scaleY = videoHeight / scaledHeight;
          const originalBbox = response.data.bbox.map((coord, index) => {
            return index % 2 === 0 ? coord * scaleX : coord * scaleY;
          });
          
          setDetectedBbox(originalBbox);
          
          if (response.data.landmarks) {
            const scaledLandmarks = response.data.landmarks.map((point, index) => {
              return index % 2 === 0 ? point * scaleX : point * scaleY;
            });
            setDetectedLandmarks(scaledLandmarks);
          }
        } else {
          setDetectedBbox(null);
          setDetectedLandmarks(null);
        }
      } catch (error) {
        if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
          console.debug('Realtime face detection error:', error);
        }
      }
    };

    detectFaceRealtime();
    previewDetectionIntervalRef.current = setInterval(() => {
      detectFaceRealtime();
    }, 100);

    return () => {
      if (previewDetectionIntervalRef.current) {
        clearInterval(previewDetectionIntervalRef.current);
        previewDetectionIntervalRef.current = null;
      }
      if (detectionAbortControllerRef.current) {
        detectionAbortControllerRef.current.abort();
        detectionAbortControllerRef.current = null;
      }
    };
  }, [show, faceVerificationStep, api]);

  // Draw detection boxes in real-time
  useEffect(() => {
    const stepsWithVideo = ['preview', 'liveness', 'action', 'capturing', 'verifying', 'retry'];
    
    if (!show || !stepsWithVideo.includes(faceVerificationStep)) {
      if (faceVerificationOverlayCanvasRef.current) {
        const ctx = faceVerificationOverlayCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, faceVerificationOverlayCanvasRef.current.width, faceVerificationOverlayCanvasRef.current.height);
      }
      return;
    }

    const animate = () => {
      drawDetectionBoxes();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [show, detectedBbox, detectedLandmarks, faceVerificationStep]);

  // Start camera when modal opens
  useEffect(() => {
    if (show && faceVerificationStep === 'preview') {
      startFaceVerificationCamera();
    }
  }, [show]);

  // Close face verification modal
  const closeFaceVerificationModal = () => {
    if (faceVerificationRetryTimeout) {
      clearInterval(faceVerificationRetryTimeout);
      setFaceVerificationRetryTimeout(null);
    }
    setFaceVerificationCountdown(0);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (previewDetectionIntervalRef.current) {
      clearInterval(previewDetectionIntervalRef.current);
      previewDetectionIntervalRef.current = null;
    }
    
    stopFaceVerificationCamera();
    setFaceVerificationStep('preview');
    setFaceVerificationProgress(0);
    setFaceVerificationMessage('');
    setFaceVerificationAttempt(0);
    setLivenessStep(1);
    setPreviousFrame(null);
    setDetectedBbox(null);
    setDetectedLandmarks(null);
  };

  // Capture and verify face
  const captureAndVerifyFace = async (isRetry = false) => {
    if (!faceVerificationVideoRef.current || !faceVerificationCanvasRef.current) {
      setFaceVerificationMessage('Camera chưa sẵn sàng. Vui lòng đợi...');
      return;
    }

    try {
      if (!isRetry) {
        setFaceVerificationAttempt(prev => prev + 1);
      }

      // Step 1: Liveness Detection
      setLivenessStep(1);
      setFaceVerificationStep('liveness');
      setFaceVerificationProgress(10);
      setFaceVerificationMessage('Bước 1/4: Di chuyển nhẹ đầu (lắc nhẹ, nghiêng...)');

      const { base64Image: frame1 } = await captureFrame();
      await new Promise(resolve => setTimeout(resolve, 500));
      const { base64Image: frame2 } = await captureFrame();

      setFaceVerificationProgress(20);

      const livenessResponse = await api.post('/face-recognition/check-liveness', {
        image: frame2,
        previous_image: frame1
      });

      if (!livenessResponse.data.success) {
        setFaceVerificationStep('error');
        const errorReason = livenessResponse.data.reason || livenessResponse.data.error || 'Không thể kiểm tra khuôn mặt.';
        setFaceVerificationMessage(`Lỗi: ${errorReason}\n\nVui lòng:\n- Đảm bảo camera hoạt động tốt\n- Có đủ ánh sáng\n- Nhìn thẳng vào camera\n- Thử lại sau vài giây`);
        return;
      }

      if (!livenessResponse.data.is_live) {
        setFaceVerificationStep('error');
        const reason = livenessResponse.data.reason || 'Không phát hiện khuôn mặt thật.';
        let detailedMessage = `Không phát hiện khuôn mặt thật.\n\nLý do: ${reason}\n\n`;
        
        if (livenessResponse.data.has_motion === false) {
          detailedMessage += '💡 Gợi ý: Hãy di chuyển nhẹ đầu để tạo chuyển động.\n';
        }
        if (livenessResponse.data.has_texture === false) {
          detailedMessage += '💡 Gợi ý: Đảm bảo có đủ ánh sáng và camera rõ nét.\n';
        }
        
        detailedMessage += '\nVui lòng thử lại.';
        setFaceVerificationMessage(detailedMessage);
        return;
      }

      const bbox = livenessResponse.data.bbox;
      setDetectedBbox(bbox);
      setPreviousFrame(frame2);
      setFaceVerificationProgress(30);

      // Step 2: Action Detection
      setLivenessStep(2);
      setFaceVerificationStep('action');
      setFaceVerificationProgress(40);

      const actionType = 'mouth';

      const actionText = 'Bước 2/4: Vui lòng há miệng hoặc cười';
      setFaceVerificationMessage(actionText);

      await new Promise(resolve => setTimeout(resolve, 3000));

      const { base64Image: actionFrame } = await captureFrame();
      setFaceVerificationProgress(50);

      const actionResponse = await api.post('/face-recognition/check-action', {
        image: actionFrame,
        bbox: bbox,
        action_type: actionType
      });

      if (!actionResponse.data.success) {
        setFaceVerificationStep('error');
        setFaceVerificationMessage(actionResponse.data.reason || 'Không thể phát hiện hành động. Vui lòng thử lại.');
        return;
      }

      const actionPassed = actionResponse.data.is_mouth_open;

      if (!actionPassed) {
        setFaceVerificationStep('error');
        setFaceVerificationMessage('Thực hiện há miệng thất bại.');
        return;
      }

      setFaceVerificationProgress(60);

      // Step 3-4: Face Detection & Recognition
      setLivenessStep(3);
      setFaceVerificationStep('capturing');
      setFaceVerificationProgress(65);
      setFaceVerificationMessage('Bước 3-4/4: Vui lòng giữ mặt bình thường trong 3 giây...');

      await new Promise(resolve => setTimeout(resolve, 3000));

      setFaceVerificationProgress(75);
      setFaceVerificationMessage('Bước 3-4/4: Đang phát hiện và nhận diện khuôn mặt...');

      const { base64Image: finalImage } = await captureFrame();
      setFaceVerificationProgress(85);
      setFaceVerificationStep('verifying');

      // Call onSuccess callback with the final image for verification
      setFaceVerificationStep('verifying');
      setFaceVerificationProgress(90);
      setFaceVerificationMessage('Đang xác minh khuôn mặt...');

      if (onSuccess) {
        try {
          const result = await onSuccess(finalImage, {
            bbox,
            landmarks: detectedLandmarks,
            attempt: faceVerificationAttempt
          });
          
          if (result === false || (result && result.verified === false)) {
            // Verification failed, show retry
            handleVerificationFailure();
            return;
          }

          // Verification passed
          setFaceVerificationProgress(100);
          setFaceVerificationStep('success');
          setFaceVerificationMessage(successMessage);
        } catch (verifyError) {
          // Handle verification error
          console.error('Verification error:', verifyError);
          handleVerificationFailure();
          return;
        }
      } else {
        // No callback provided, just show success
        setFaceVerificationProgress(100);
        setFaceVerificationStep('success');
        setFaceVerificationMessage(successMessage);
      }
    } catch (error) {
      console.error('Error in face verification:', error);
      setFaceVerificationStep('error');
      if (error.response?.data?.message) {
        setFaceVerificationMessage(error.response.data.message);
      } else {
        setFaceVerificationMessage('Có lỗi xảy ra trong quá trình xác thực. Vui lòng thử lại.');
      }
      if (onError) onError(error);
    }
  };

  // Handle verification failure
  const handleVerificationFailure = () => {
    if (faceVerificationAttempt >= maxAttempts) {
      setFaceVerificationStep('error');
      setFaceVerificationMessage('Khuôn mặt không khớp sau nhiều lần thử. Xác minh bị từ chối.');
      return;
    }

    setFaceVerificationStep('retry');
    setFaceVerificationMessage('Khuôn mặt không khớp. Đang thử lại...');
    
    if (showRetryCountdown) {
      let countdown = Math.floor(retryTimeout / 1000);
      setFaceVerificationCountdown(countdown);
      
      const timeout = setInterval(() => {
        countdown--;
        setFaceVerificationCountdown(countdown);
        
        if (countdown <= 0) {
          clearInterval(timeout);
          setFaceVerificationRetryTimeout(null);
          setFaceVerificationCountdown(0);
          setFaceVerificationStep('preview');
          setTimeout(() => captureAndVerifyFace(true), 500);
        }
      }, 1000);
      
      setFaceVerificationRetryTimeout(timeout);
    } else {
      setTimeout(() => {
        setFaceVerificationStep('preview');
        setTimeout(() => captureAndVerifyFace(true), 500);
      }, retryTimeout);
    }
  };

  // Handle modal close
  const handleClose = () => {
    closeFaceVerificationModal();
    if (onHide) onHide();
    if (onCancel) onCancel();
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="lg"
      centered
      backdrop="static"
      keyboard={false}
      className="face-verification-modal"
    >
      <Modal.Body className="face-verification-body">
        <div className="face-verification-container">
          {/* Camera Preview */}
          {(faceVerificationStep === 'preview' || 
            faceVerificationStep === 'liveness' ||
            faceVerificationStep === 'action' ||
            faceVerificationStep === 'capturing' || 
            faceVerificationStep === 'verifying' || 
            faceVerificationStep === 'retry') && (
            <div className="session-card mb-4">
              <div className="card-body-modern p-0">
                <div className="position-relative" style={{ borderRadius: '0', overflow: 'hidden', backgroundColor: '#000' }}>
                  <div className="position-absolute top-0 start-0 w-100 d-flex justify-content-center" style={{ zIndex: 10, paddingTop: '20px' }}>
                    <p className="mb-0 face-verification-subtitle" style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#ffffff',
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      padding: '8px 20px',
                      borderRadius: '20px',
                      backdropFilter: 'blur(4px)'
                    }}>
                      {faceVerificationStep === 'preview' && 'Chuẩn bị chụp ảnh để xác minh'}
                      {faceVerificationStep === 'liveness' && 'Di chuyển nhẹ đầu (lắc nhẹ, nghiêng...)'}
                      {faceVerificationStep === 'action' && 'Đang yêu cầu há miệng'}
                      {faceVerificationStep === 'capturing' && 'Đang chụp ảnh khuôn mặt'}
                      {faceVerificationStep === 'verifying' && 'Đang xác minh danh tính'}
                      {faceVerificationStep === 'retry' && 'Đang thử lại...'}
                    </p>
                  </div>
                  
                  <div className="position-relative" style={{ width: '100%', height: 'auto' }}>
                    <video
                      ref={faceVerificationVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        maxWidth: '100%',
                        height: 'auto',
                        display: 'block',
                        objectFit: 'contain' // Ensure video maintains aspect ratio
                      }}
                    />
                    <canvas
                      ref={faceVerificationOverlayCanvasRef}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        zIndex: 5,
                        objectFit: 'contain' // Match video's object-fit
                      }}
                    />
                  </div>
                  <canvas ref={faceVerificationCanvasRef} style={{ display: 'none' }} />
                </div>
              </div>
            </div>
          )}

          {/* Overlay during processing */}
          {(faceVerificationStep === 'liveness' ||
            faceVerificationStep === 'action' ||
            faceVerificationStep === 'capturing' || 
            faceVerificationStep === 'verifying' || 
            faceVerificationStep === 'retry') && (
            <div className="card-body-modern pt-3">
              <div className="d-flex flex-column align-items-center justify-content-center">
                <Spinner animation="border" variant="primary" className="mb-3" style={{ width: '3rem', height: '3rem' }} />
                <div className="fw-bold mb-3 text-center" style={{ fontSize: '16px', color: '#495057' }}>
                  {faceVerificationMessage || 'Đang xử lý...'}
                </div>
                {faceVerificationProgress > 0 && (
                  <div className="w-100" style={{ maxWidth: '400px' }}>
                    <ProgressBar
                      now={faceVerificationProgress}
                      variant="success"
                      animated
                      className="mb-2"
                      style={{ height: '8px', borderRadius: '4px' }}
                    />
                    <div className="text-center">
                      <small style={{ fontSize: '14px', color: '#6c757d' }}>{faceVerificationProgress}%</small>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success State */}
          {faceVerificationStep === 'success' && (
            <div className="session-card">
              <div className="card-body-modern text-center py-5">
                <div className="rounded-circle bg-success bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-4" style={{ width: '100px', height: '100px' }}>
                  <CheckCircle size={50} className="text-success" />
                </div>
                <h5 className="text-success mb-3" style={{ fontSize: '20px', fontWeight: '600' }}>{successMessage}</h5>
                <p className="text-muted mb-0" style={{ fontSize: '15px' }}>{faceVerificationMessage}</p>
              </div>
            </div>
          )}

          {/* Retry State with Countdown */}
          {faceVerificationStep === 'retry' && (
            <div className="session-card">
              <div className="card-body-modern text-center py-5">
                <div className="rounded-circle bg-warning bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-4" style={{ width: '100px', height: '100px' }}>
                  <i className="fas fa-redo text-warning" style={{ fontSize: '50px' }}></i>
                </div>
                <h5 className="text-warning mb-3" style={{ fontSize: '20px', fontWeight: '600' }}>Thử lại</h5>
                <div className="text-muted mb-3" style={{ whiteSpace: 'pre-line', textAlign: 'center', maxWidth: '500px', margin: '0 auto', fontSize: '15px' }}>
                  {faceVerificationMessage}
                </div>
                {faceVerificationCountdown > 0 && (
                  <div className="mb-3">
                    <div className="fw-bold text-primary" style={{ fontSize: '48px', lineHeight: '1' }}>
                      {faceVerificationCountdown}
                    </div>
                    <div className="text-muted small">giây</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error State */}
          {faceVerificationStep === 'error' && (
            <div className="session-card">
              <div className="card-body-modern text-center py-5">
                <div className="rounded-circle bg-danger bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-4" style={{ width: '100px', height: '100px' }}>
                  <i className="fas fa-times text-danger" style={{ fontSize: '50px' }}></i>
                </div>
                <h5 className="text-danger mb-3" style={{ fontSize: '20px', fontWeight: '600' }}>{errorMessage}</h5>
                <div className="text-muted mb-0" style={{ whiteSpace: 'pre-line', textAlign: 'center', maxWidth: '500px', margin: '0 auto', fontSize: '15px' }}>
                  {faceVerificationMessage}
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          {faceVerificationStep === 'preview' && (
            <div className="card-body-modern">
              <div className="info-item-inline">
                <span className="text-muted" style={{ fontSize: '14px' }}>
                  Đảm bảo khuôn mặt của bạn rõ ràng và được chiếu sáng đầy đủ
                </span>
              </div>
              <div className="info-item-inline">
                <span className="text-muted" style={{ fontSize: '14px' }}>
                  Nhìn thẳng vào camera và giữ khoảng cách phù hợp
                </span>
              </div>
              {faceVerificationAttempt > 0 && (
                <Alert variant="warning" className="mt-3 mb-0" style={{ fontSize: '14px' }}>
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  Lần thử {faceVerificationAttempt}/{maxAttempts}
                </Alert>
              )}
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer className="face-verification-footer">
        <div className="face-verification-footer-content">
          {faceVerificationStep === 'preview' && (
            <Button
              variant="primary"
              onClick={() => captureAndVerifyFace(false)}
              disabled={faceVerificationStep !== 'preview'}
              className="face-verification-btn-primary face-verification-btn-center"
            >
              <Camera size={20} className="me-2" />
              Chụp ảnh và xác minh
            </Button>
          )}
          {faceVerificationStep === 'error' && (
            <div className="d-flex gap-3 justify-content-center w-100">
              <Button
                variant="outline-secondary"
                onClick={handleClose}
                className="face-verification-btn-cancel"
              >
                <i className="fas fa-times me-2"></i>
                Đóng
              </Button>
              {faceVerificationAttempt < maxAttempts && (
                <Button
                  variant="primary"
                  onClick={async () => {
                    if (faceVerificationRetryTimeout) {
                      clearInterval(faceVerificationRetryTimeout);
                      setFaceVerificationRetryTimeout(null);
                    }
                    setFaceVerificationCountdown(0);
                    
                    setFaceVerificationStep('preview');
                    setFaceVerificationProgress(0);
                    setFaceVerificationMessage('');
                    setLivenessStep(1);
                    setPreviousFrame(null);
                    setDetectedBbox(null);
                    stopFaceVerificationCamera();
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await startFaceVerificationCamera();
                    setTimeout(() => captureAndVerifyFace(true), 500);
                  }}
                  className="face-verification-btn-primary"
                >
                  <i className="fas fa-redo me-2"></i>
                  Thử lại
                </Button>
              )}
            </div>
          )}
          {faceVerificationStep === 'success' && (
            <Button
              variant="success"
              onClick={handleClose}
              className="face-verification-btn-success face-verification-btn-center"
            >
              <i className="fas fa-check-circle me-2"></i>
              Hoàn tất
            </Button>
          )}
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default FaceVerificationModal;

