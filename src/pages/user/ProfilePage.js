import React, { useState, useEffect, useRef } from 'react';
import { Form, Button, Container, Row, Col, Alert, InputGroup, ProgressBar, Tab, Tabs, Modal } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';

const DOTLOTTIE_SCRIPT = 'https://unpkg.com/@lottiefiles/dotlottie-wc@0.8.5/dist/dotlottie-wc.js';
const ensureDotlottie = () => {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`script[src="${DOTLOTTIE_SCRIPT}"]`)) return;
  const s = document.createElement('script');
  s.type = 'module';
  s.src = DOTLOTTIE_SCRIPT;
  document.head.appendChild(s);
};
import { useTranslation } from 'react-i18next';
import { User, Mail, Lock, Eye, EyeOff, CheckCircle, AlertTriangle, Save, Bell, FileText, Shield, Upload, RotateCcw, MapPin, Phone, Building, RefreshCcw, Camera, X, Calendar } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import { getUploadsBaseURL } from '../../utils/api';
import '../../styles/auth.css';
import '../../styles/modern-ui.css';

const ProfilePage = () => {
  const { t, i18n } = useTranslation();
  usePageTitle(t('profile.title'));
  const { currentUser, api, updateUserState } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [profilePicture, setProfilePicture] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  
  // Face recognition states
  const [faceSampleStatus, setFaceSampleStatus] = useState(null);
  const [faceSampleImage, setFaceSampleImage] = useState(null);
  const [faceSampleRegisteredAt, setFaceSampleRegisteredAt] = useState(null);
  const [isCapturingFace, setIsCapturingFace] = useState(false);
  const [faceCaptureError, setFaceCaptureError] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [faceCaptureSuccess, setFaceCaptureSuccess] = useState('');
  const [videoRef, setVideoRef] = useState(null);
  const [streamRef, setStreamRef] = useState(null);
  const [hasPendingUpdateRequest, setHasPendingUpdateRequest] = useState(false);
  const [pendingRequestType, setPendingRequestType] = useState(null); // 'force' or 'allow'
  const [registeredFaceImage, setRegisteredFaceImage] = useState(null); // Store registered image for modal display
  const [canReregister, setCanReregister] = useState(false); // Track if user can re-register (within 5 minutes)
  const [reregisterTimer, setReregisterTimer] = useState(null); // Timer for 5-minute window
  
  // Refs for background polling
  const faceSampleDataRef = useRef(null); // Store current face sample data for comparison
  
  // Modal states
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [captureStep, setCaptureStep] = useState('preview'); // 'preview', 'liveness', 'action', 'capturing', 'uploading', 'success', 'error'
  const [captureProgress, setCaptureProgress] = useState(0);
  const [livenessStep, setLivenessStep] = useState(1); // 1: liveness, 2: action, 3: face detection, 4: face recognition
  const [requiredAction, setRequiredAction] = useState(null); // 'mouth' only
  const [detectedBbox, setDetectedBbox] = useState(null);
  const [previousFrame, setPreviousFrame] = useState(null);
  const videoElementRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Thêm state cho việc kiểm tra mật khẩu
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false
  });

  useEffect(() => { ensureDotlottie(); }, []);
  useEffect(() => {
    setMounted(true);
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        fullName: currentUser.full_name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || ''
      }));
    }
    return () => setMounted(false);
  }, [currentUser]);

  // Function to get user's current location
  const getUserLocation = async () => {
    if (!navigator.geolocation) {
      setError(t('profile.errors.locationNotSupported'));
      return;
    }

    setLocationLoading(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        });
      });

      const { latitude, longitude } = position.coords;
      
      // Reverse geocoding to get address
      try {
        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=vi`
        );
        const data = await response.json();
        
        if (data.city && data.principalSubdivision) {
          setUserLocation({
            address: `${data.locality || data.city}, ${data.principalSubdivision}, ${data.countryName}`,
            coordinates: { latitude, longitude }
          });
        } else {
          setUserLocation({
            address: `Vị trí: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            coordinates: { latitude, longitude }
          });
        }
      } catch (geocodeError) {
        console.error('Reverse geocoding error:', geocodeError);
        setUserLocation({
          address: `Vị trí: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          coordinates: { latitude, longitude }
        });
      }
    } catch (error) {
      console.error('Location error:', error);
      setError(t('profile.errors.locationError'));
    } finally {
      setLocationLoading(false);
    }
  };

  // Get location on component mount
  useEffect(() => {
    getUserLocation();
    checkFaceSampleStatus();
  }, []);

  // Helper function to compare face sample data
  const hasFaceSampleDataChanged = (oldData, newData) => {
    if (!oldData || !newData) return true;
    
    return (
      oldData.hasFaceSample !== newData.hasFaceSample ||
      oldData.faceSampleImage !== newData.faceSampleImage ||
      oldData.registeredAt !== newData.registeredAt ||
      oldData.hasPendingUpdateRequest !== newData.hasPendingUpdateRequest ||
      oldData.pendingRequestType !== newData.pendingRequestType
    );
  };

  // Check face sample status
  const checkFaceSampleStatus = async (silent = false) => {
    try {
      const response = await api.get('/profile/face-sample/status');
      if (response.data.success) {
        const newData = {
          hasFaceSample: response.data.data.hasFaceSample,
          faceSampleImage: response.data.data.faceSampleImage,
          registeredAt: response.data.data.registeredAt,
          hasPendingUpdateRequest: response.data.data.hasPendingUpdateRequest || false,
          pendingRequestType: response.data.data.pendingRequest?.update_type || null
        };
        
        // Only update if data actually changed (for silent updates)
        if (silent) {
          const currentData = faceSampleDataRef.current;
          if (!hasFaceSampleDataChanged(currentData, newData)) {
            // No changes, skip update
            return;
          }
        }
        
        // Update state
        setFaceSampleStatus(newData.hasFaceSample);
        setFaceSampleImage(newData.faceSampleImage);
        setFaceSampleRegisteredAt(newData.registeredAt);
        setHasPendingUpdateRequest(newData.hasPendingUpdateRequest);
        setPendingRequestType(newData.pendingRequestType);
        
        // Check if user can re-register (within 5 minutes of registration)
        if (newData.registeredAt) {
          const registeredTime = new Date(newData.registeredAt).getTime();
          const currentTime = Date.now();
          const timeDiff = currentTime - registeredTime;
          const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
          
          if (timeDiff < fiveMinutes && !newData.hasPendingUpdateRequest) {
            setCanReregister(true);
            // Set timer to disable re-register after remaining time
            const remainingTime = fiveMinutes - timeDiff;
            if (reregisterTimer) {
              clearTimeout(reregisterTimer);
            }
            const timer = setTimeout(() => {
              setCanReregister(false);
            }, remainingTime);
            setReregisterTimer(timer);
          } else {
            setCanReregister(false);
            if (reregisterTimer) {
              clearTimeout(reregisterTimer);
              setReregisterTimer(null);
            }
          }
        }
        
        // Store for comparison
        faceSampleDataRef.current = newData;
      }
      
    } catch (error) {
      if (!silent) {
        console.error('Error checking face sample status:', error);
      }
    }
  };

  // Background polling for face sample status - only update when data changes
  useEffect(() => {
    let pollInterval;
    let isMounted = true;
    let currentPolling = false;
    
    const pollFaceSampleStatus = async () => {
      if (currentPolling || !isMounted) return;
      
      try {
        currentPolling = true;
        
        const response = await api.get('/profile/face-sample/status');
        
        if (!isMounted) {
          currentPolling = false;
          return;
        }
        
        if (response.data.success) {
          const newData = {
            hasFaceSample: response.data.data.hasFaceSample,
            faceSampleImage: response.data.data.faceSampleImage,
            registeredAt: response.data.data.registeredAt,
            hasPendingUpdateRequest: response.data.data.hasPendingUpdateRequest || false,
            pendingRequestType: response.data.data.pendingRequest?.update_type || null
          };
          
          // Compare with current data - only update if changed
          const currentData = faceSampleDataRef.current;
          if (hasFaceSampleDataChanged(currentData, newData)) {
            // Data changed, update silently
            setFaceSampleStatus(newData.hasFaceSample);
            setFaceSampleImage(newData.faceSampleImage);
            setFaceSampleRegisteredAt(newData.registeredAt);
            setHasPendingUpdateRequest(newData.hasPendingUpdateRequest);
            setPendingRequestType(newData.pendingRequestType);
            faceSampleDataRef.current = newData;
          }
        }
      } catch (error) {
        console.debug('Background polling error (silent):', error);
      } finally {
        currentPolling = false;
      }
    };
    
    // Start polling after initial load (10 seconds delay)
    const initialDelay = setTimeout(() => {
      if (isMounted) {
        // Poll every 5 seconds (reduced frequency)
        pollInterval = setInterval(pollFaceSampleStatus, 5000);
      }
    }, 10000);
    
    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  // Open face registration modal
  const openFaceModal = () => {
    setShowFaceModal(true);
    setCaptureStep('preview');
    setFaceCaptureError('');
    setFaceCaptureSuccess('');
    setCaptureProgress(0);
    setLivenessStep(1);
    setRequiredAction(null);
    setDetectedBbox(null);
    setPreviousFrame(null);
    startCamera();
  };

  // Close modal and cleanup
  const closeFaceModal = () => {
    stopCamera();
    setShowFaceModal(false);
    setCaptureStep('preview');
    setFaceCaptureError('');
    setFaceCaptureSuccess('');
    setCaptureProgress(0);
    setLivenessStep(1);
    setRequiredAction(null);
    setDetectedBbox(null);
    setPreviousFrame(null);
    setRegisteredFaceImage(null);
    if (reregisterTimer) {
      clearTimeout(reregisterTimer);
      setReregisterTimer(null);
    }
  };
  
  // Handle re-register button click
  const handleReregister = () => {
    setCaptureStep('preview');
    setFaceCaptureError('');
    setFaceCaptureSuccess('');
    setCaptureProgress(0);
    setLivenessStep(1);
    setRequiredAction(null);
    setDetectedBbox(null);
    setPreviousFrame(null);
    setRegisteredFaceImage(null);
    startCamera();
  };
  
  // Handle complete button click
  const handleComplete = () => {
    closeFaceModal();
  };
  
  // Handle request face reset
  const handleRequestFaceReset = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.post('/profile/face-sample/request-reset');
      
      if (response.data.success) {
        setSuccess(t('profile.success.faceResetRequestSent'));
        // Refresh status to show pending request
        await checkFaceSampleStatus();
      } else {
        setError(response.data.message || t('profile.errors.faceResetError'));
      }
    } catch (error) {
      console.error('Error requesting face reset:', error);
      setError(error.response?.data?.message || t('profile.errors.faceResetErrorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  // Start camera stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }
      });

      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream;
        setStreamRef(stream);
        setCaptureStep('preview');
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setCaptureStep('error');
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setFaceCaptureError(t('profile.errors.cameraPermissionDenied'));
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setFaceCaptureError(t('profile.errors.cameraNotFound'));
      } else {
        setFaceCaptureError(t('profile.errors.cameraError'));
      }
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef) {
      streamRef.getTracks().forEach(track => track.stop());
      setStreamRef(null);
    }
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
    }
  };

  // Helper function to capture frame from video
  const captureFrame = async () => {
    const video = videoElementRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Wait for video to be ready
    if (video.readyState < 2) {
      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
        video.onloadeddata = resolve;
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    // Get actual video dimensions
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Set canvas size to match video dimensions
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

    // Get image as blob
    const imageBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Không thể tạo ảnh từ camera'));
      }, 'image/jpeg', 0.8);
    });

    // Convert blob to base64
    const reader = new FileReader();
    const base64Image = await new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });

    return { base64Image, imageBlob };
  };

  // Capture face sample from webcam with 4-step liveness detection
  const captureFaceSample = async () => {
    if (!videoElementRef.current || !canvasRef.current) {
      setFaceCaptureError('Camera chưa sẵn sàng. Vui lòng đợi...');
      return;
    }

    try {
      // ============================================
      // BƯỚC 1: Liveness Detection
      // ============================================
      setLivenessStep(1);
      setCaptureStep('liveness');
      setCaptureProgress(10);
      setFaceCaptureError('');
      setFaceCaptureSuccess(t('profile.faceCapture.step1'));

      const { base64Image: frame1, imageBlob: blob1 } = await captureFrame();
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for motion
      const { base64Image: frame2 } = await captureFrame();

      setCaptureProgress(20);

      // Call liveness detection API
      const livenessResponse = await api.post('/face-recognition/check-liveness', {
        image: frame2,
        previous_image: frame1
      });

      if (!livenessResponse.data.success) {
        setCaptureStep('error');
        const errorReason = livenessResponse.data.reason || livenessResponse.data.error || 'Không thể kiểm tra khuôn mặt.';
        setFaceCaptureError(`Lỗi: ${errorReason}\n\nVui lòng:\n- Đảm bảo camera hoạt động tốt\n- Có đủ ánh sáng\n- Nhìn thẳng vào camera\n- Thử lại sau vài giây`);
        return;
      }

      if (!livenessResponse.data.is_live) {
        setCaptureStep('error');
        const reason = livenessResponse.data.reason || 'Không phát hiện khuôn mặt thật.';
        let detailedMessage = `Không phát hiện khuôn mặt thật.\n\nLý do: ${reason}\n\n`;
        
        // Add specific guidance based on failure
        if (livenessResponse.data.has_motion === false) {
          detailedMessage += '💡 Gợi ý: Hãy di chuyển nhẹ đầu để tạo chuyển động.\n';
        }
        if (livenessResponse.data.has_texture === false) {
          detailedMessage += '💡 Gợi ý: Đảm bảo có đủ ánh sáng và camera rõ nét.\n';
        }
        
        detailedMessage += '\nVui lòng thử lại.';
        setFaceCaptureError(detailedMessage);
        return;
      }

      const bbox = livenessResponse.data.bbox;
      setDetectedBbox(bbox);
      setPreviousFrame(frame2);
      setCaptureProgress(30);

      // ============================================
      // BƯỚC 2: Action Detection (Random)
      // ============================================
      setLivenessStep(2);
      setCaptureStep('action');
      setCaptureProgress(40);

      // Action: mouth only
      const actionType = 'mouth';
      setRequiredAction(actionType);

      const actionText = t('profile.faceCapture.step2');
      setFaceCaptureSuccess(actionText);

      // For blink detection: capture multiple frames to catch the blink moment
      let actionFrame = null;
      let actionResponse = null;
      
      if (actionType === 'blink') {
        // Capture baseline frame first (eyes open) - take average of 2 frames
        let baselineEAR = null;
        const baselineFrames = [];
        for (let i = 0; i < 2; i++) {
          const frame = await captureFrame();
          baselineFrames.push(frame.base64Image);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Calculate average baseline EAR
        const baselineEARs = [];
        for (const frame of baselineFrames) {
          try {
            const baselineResponse = await api.post('/face-recognition/check-action', {
              image: frame,
              bbox: bbox,
              action_type: actionType
            });
            if (baselineResponse.data.success && baselineResponse.data.ear !== undefined) {
              baselineEARs.push(baselineResponse.data.ear);
            }
          } catch (err) {
            console.debug('Error getting baseline EAR:', err);
          }
        }
        
        if (baselineEARs.length > 0) {
          baselineEAR = baselineEARs.reduce((a, b) => a + b, 0) / baselineEARs.length;
        }
        
        // Capture multiple frames rapidly to catch the blink moment
        const frameData = []; // Store frame + EAR data
        const captureCount = 8; // Capture 8 frames over 3 seconds
        const interval = 3000 / captureCount; // ~375ms between captures
        
        // Capture all frames first (faster)
        const frames = [];
        for (let i = 0; i < captureCount; i++) {
          await new Promise(resolve => setTimeout(resolve, interval));
          const frame = await captureFrame();
          frames.push(frame.base64Image);
        }
        
        // Then check frames to find blink - detect EAR changes between frames
        let foundBlink = false;
        let previousEAR = baselineEAR;
        
        for (let i = 0; i < frames.length; i++) {
          try {
            const testResponse = await api.post('/face-recognition/check-action', {
              image: frames[i],
              bbox: bbox,
              action_type: actionType
            });
            
            if (testResponse.data.success && testResponse.data.ear !== undefined) {
              const currentEAR = testResponse.data.ear;
              frameData.push({
                frame: frames[i],
                ear: currentEAR,
                response: testResponse.data
              });
              
              // Check multiple conditions for blink detection
              let isBlink = false;
              
              // 1. Absolute threshold
              if (currentEAR < 0.4) {
                isBlink = true;
              }
              // 2. Relative to baseline (if available)
              else if (baselineEAR !== null) {
                const earDrop = baselineEAR - currentEAR;
                // If EAR drops by more than 15% from baseline
                if (earDrop > baselineEAR * 0.15) {
                  isBlink = true;
                }
              }
              // 3. Detect sudden drop between consecutive frames (blink moment)
              if (previousEAR !== null && previousEAR > 0) {
                const earChange = previousEAR - currentEAR;
                // If EAR suddenly drops by more than 0.08 (significant change)
                if (earChange > 0.08) {
                  isBlink = true;
                }
              }
              
              if (isBlink) {
                actionFrame = frames[i];
                actionResponse = testResponse.data;
                actionResponse.is_blinking = true;
                foundBlink = true;
                break; // Found blink, stop checking
              }
              
              previousEAR = currentEAR;
            }
          } catch (err) {
            console.debug('Error checking frame EAR:', err);
          }
        }
        
        // If no blink found during checking, analyze all collected frames
        if (!foundBlink) {
          // Find frame with lowest EAR (most closed eyes)
          let bestFrame = frameData.length > 0 ? frameData[0].frame : frames[frames.length - 1];
          let bestResponse = null;
          let lowestEAR = Infinity;
          
          for (const data of frameData) {
            if (data.ear < lowestEAR) {
              lowestEAR = data.ear;
              bestFrame = data.frame;
              bestResponse = data.response;
            }
          }
          
          // Check if lowest EAR is significantly lower than baseline
          if (bestResponse && baselineEAR !== null) {
            const earDrop = baselineEAR - lowestEAR;
            // If EAR dropped by at least 15% from baseline, consider it a blink
            // This is more lenient to catch partial blinks
            if (earDrop > baselineEAR * 0.15) {
              bestResponse.is_blinking = true;
              actionFrame = bestFrame;
              actionResponse = bestResponse;
            } else {
              // Still use the best frame, but mark as not blinking
              actionFrame = bestFrame;
              actionResponse = bestResponse;
            }
          } else if (bestResponse) {
            // No baseline, use absolute threshold
            if (lowestEAR < 0.4) {
              bestResponse.is_blinking = true;
            }
            actionFrame = bestFrame;
            actionResponse = bestResponse;
          } else if (frames.length > 0) {
            // Fallback: check last frame
            try {
              actionFrame = frames[frames.length - 1];
              actionResponse = await api.post('/face-recognition/check-action', {
                image: actionFrame,
                bbox: bbox,
                action_type: actionType
              }).then(res => res.data).catch(() => ({ success: false, is_blinking: false }));
            } catch (err) {
              actionFrame = frames[frames.length - 1];
              actionResponse = { success: false, is_blinking: false };
            }
          }
        }
      } else {
        // For mouth action: wait 3 seconds then capture
        await new Promise(resolve => setTimeout(resolve, 3000));
        const frame = await captureFrame();
        actionFrame = frame.base64Image;
        actionResponse = await api.post('/face-recognition/check-action', {
          image: actionFrame,
          bbox: bbox,
          action_type: actionType
        }).then(res => res.data).catch(() => null);
      }
      
      setCaptureProgress(50);

      // Check action response
      if (!actionResponse || !actionResponse.success) {
        setCaptureStep('error');
        setFaceCaptureError(actionResponse?.reason || 'Không thể phát hiện hành động. Vui lòng thử lại.');
        return;
      }

      const actionPassed = actionResponse.is_mouth_open;

      if (!actionPassed) {
        setCaptureStep('error');
        setFaceCaptureError('Thực hiện há miệng thất bại.');
        return;
      }

      setCaptureProgress(60);

      // ============================================
      // BƯỚC 3-4: Face Detection & Recognition (Extract Embedding)
      // ============================================
      setLivenessStep(3);
      setCaptureStep('capturing');
      setCaptureProgress(65);
      setFaceCaptureSuccess(t('profile.faceCapture.step3'));

      // Wait 3 seconds for face to return to normal before final capture
      await new Promise(resolve => setTimeout(resolve, 3000));

      setCaptureProgress(75);
      setFaceCaptureSuccess(t('profile.faceCapture.step4'));

      // Final capture for face registration
      const { base64Image: finalImage } = await captureFrame();
      setCaptureProgress(85);
      setCaptureStep('uploading');

      // Send to backend
      const response = await api.post('/profile/face-sample', {
        image: finalImage
      });

      setCaptureProgress(100);

      if (response.data.success) {
        setCaptureStep('success');
        setFaceCaptureSuccess(t('profile.faceCapture.registrationSuccess'));
        setFaceSampleStatus(true);
        
        // Refresh face sample data to get image path
        await checkFaceSampleStatus();
        
        // Store the registered image for display in modal
        if (response.data.data?.imagePath) {
          setRegisteredFaceImage(response.data.data.imagePath);
        } else {
          // If imagePath not in response, get it from status check
          const statusResponse = await api.get('/profile/face-sample/status');
          if (statusResponse.data.success && statusResponse.data.data.faceSampleImage) {
            setRegisteredFaceImage(statusResponse.data.data.faceSampleImage);
          }
        }
        
        // Enable re-register button for 5 minutes
        setCanReregister(true);
        const timer = setTimeout(() => {
          setCanReregister(false);
        }, 5 * 60 * 1000); // 5 minutes
        setReregisterTimer(timer);
        
        // Don't auto close modal - keep it open with success state
      }
    } catch (error) {
      console.error('Error capturing face sample:', error);
      setCaptureStep('error');
      if (error.response?.data?.message) {
        setFaceCaptureError(error.response.data.message);
      } else if (error.response?.data?.error) {
        setFaceCaptureError(error.response.data.error);
      } else {
        setFaceCaptureError('Có lỗi xảy ra khi đăng ký khuôn mặt. Vui lòng thử lại.');
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Nếu là mật khẩu mới thì kiểm tra độ mạnh
    if (name === 'newPassword') {
      setPasswordStrength(checkPasswordStrength(value));
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Thêm hàm kiểm tra độ mạnh mật khẩu
  const checkPasswordStrength = (password) => {
    const result = {
      score: 0,
      hasMinLength: password.length >= 6,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    
    // Tính điểm
    if (result.hasMinLength) result.score += 1;
    if (result.hasUpperCase) result.score += 1;
    if (result.hasLowerCase) result.score += 1;
    if (result.hasNumber) result.score += 1;
    if (result.hasSpecialChar) result.score += 1;
    
    return result;
  };
  
  // Lấy màu cho thanh tiến trình mật khẩu
  const getPasswordStrengthColor = (score) => {
    if (score <= 1) return 'danger';
    if (score <= 2) return 'warning';
    if (score <= 3) return 'info';
    return 'success';
  };
  
  // Lấy label cho độ mạnh mật khẩu
  const getPasswordStrengthLabel = (score) => {
    if (score <= 1) return t('profile.passwordStrength.weak');
    if (score <= 2) return t('profile.passwordStrength.medium');
    if (score <= 3) return t('profile.passwordStrength.good');
    if (score === 4) return t('profile.passwordStrength.strong');
    return t('profile.passwordStrength.veryStrong');
  };
  
  const isPasswordValid = () => {
    // Kiểm tra các trường cơ bản
    const basicFieldsValid = formData.currentPassword && formData.newPassword && formData.confirmPassword;
    
    // Kiểm tra mật khẩu khớp
    const passwordsMatch = formData.newPassword === formData.confirmPassword;
    
    // Kiểm tra độ mạnh mật khẩu
    const passwordStrengthValid = passwordStrength.score >= 3;
    
    return basicFieldsValid && passwordsMatch && passwordStrengthValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate form
    if (showPasswordFields) {
      if (!formData.currentPassword) {
        return setError(t('profile.errors.currentPasswordRequired'));
      }

      if (formData.newPassword !== formData.confirmPassword) {
        return setError(t('profile.errors.passwordsNotMatch'));
      }

      if (formData.newPassword && formData.newPassword.length < 6) {
        return setError(t('profile.errors.passwordMinLength'));
      }
      
      // Kiểm tra độ mạnh mật khẩu
      if (passwordStrength.score < 3) {
        return setError(t('profile.errors.passwordNotStrong'));
      }
    }

    try {
      setLoading(true);
      
      // Upload avatar if a new one was selected
      if (profilePicture) {
        const formDataAvatar = new FormData();
        formDataAvatar.append('avatar', profilePicture);
        
        try {
          const avatarResponse = await api.post('/profile/avatar', formDataAvatar, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          
          if (avatarResponse.data.success) {
            // Update current user state with new avatar
            const updatedUser = {
              ...currentUser,
              profile_picture: avatarResponse.data.data.profile_picture
            };
            updateUserState(updatedUser, localStorage.getItem('token'));
            setSuccess(t('profile.success.avatarUpdateSuccess'));
            // Reset profile picture state
            setProfilePicture(null);
          }
        } catch (avatarError) {
          console.error('Error uploading avatar:', avatarError);
          setError(avatarError.response?.data?.message || t('profile.errors.avatarUploadError'));
          setLoading(false);
          return;
        }
      }
      
      const updateData = {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone
      };

      if (showPasswordFields && formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      const response = await api.put('/profile', updateData);

      if (response.data.success) {
        setSuccess(t('profile.success.updateSuccess'));
        
        // Reset password fields
        if (showPasswordFields) {
          setFormData(prev => ({
            ...prev,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          }));
          setPasswordStrength({
            score: 0,
            hasMinLength: false,
            hasUpperCase: false,
            hasLowerCase: false,
            hasNumber: false,
            hasSpecialChar: false
          });
          setShowPasswordFields(false);
        }
        
        // Refresh user data to get updated info
        try {
          const userResponse = await api.get('/auth/me');
          if (userResponse.data.success && userResponse.data.data) {
            updateUserState(userResponse.data.data, localStorage.getItem('token'));
          }
        } catch (refreshError) {
          console.error('Error refreshing user data:', refreshError);
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(error.response?.data?.message || t('profile.errors.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const toggleShowCurrentPassword = () => {
    setShowCurrentPassword(!showCurrentPassword);
  };

  const toggleShowNewPassword = () => {
    setShowNewPassword(!showNewPassword);
  };

  const toggleShowConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleProfilePictureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 3000 * 1024) { // 3MB limit
        setError(t('profile.errors.avatarSizeError'));
        return;
      }
      if (!file.type.match(/^image\/(jpeg|jpg|gif|png)$/)) {
        setError(t('profile.errors.avatarFormatError'));
        return;
      }
      setProfilePicture(file);
      setError('');
    }
  };

  // Helper function to get display name for roles
  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'superadmin': return t('user.superAdmin');
      case 'admin': return t('user.admin');
      case 'staff': return t('user.staff');
      case 'student': return t('user.student');
      default: return role;
    }
  };

  return (
    <div>
      <Container className="py-1">

        {error && (
          <div className="modern-alert modern-alert-danger mb-4">
            <div className="d-flex align-items-center">
              <AlertTriangle size={20} className="me-2 text-danger" />
              <div>{error}</div>
            </div>
          </div>
        )}
        
        {success && (
          <div className="modern-alert modern-alert-success mb-4">
            <div className="d-flex align-items-center">
              <CheckCircle size={20} className="me-2 text-success" />
              <div>{success}</div>
            </div>
          </div>
        )}

        <Form onSubmit={handleSubmit}>

                    {/* Personal Details Card */}
                    <div className="modern-card mb-4">
            <div className="p-4">
              <h5 className="fw-bold mb-2">{t('profile.personalInfo')}</h5>
              <p className="text-muted small mb-4">{t('profile.personalInfoDesc')}</p>
              
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-medium">{t('profile.fullName')}</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="bg-light">
                        <User size={16} />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        required
                        className="modern-form-control"
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-medium">{t('profile.currentLocation')}</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="bg-light">
                        <MapPin size={16} />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        value={userLocation ? userLocation.address : (locationLoading ? t('profile.gettingLocation') : t('profile.locationNotDetermined'))}
                        disabled
                        className="modern-form-control bg-light"
                      />
                      <button
                        type="button"
                        className="btn-modern"
                        onClick={getUserLocation}
                        disabled={locationLoading}
                        style={{ backgroundColor: '#256176', padding: '8px 12px' }}
                        title={t('profile.updateLocation')}
                      >
                        {locationLoading ? (
                          <div className="spinner-border spinner-border-sm" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                        ) : (
                          <RefreshCcw size={16} />
                        )}
                      </button>
                    </InputGroup>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-medium">{t('profile.email')}</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="bg-light">
                        <Mail size={16} />
                      </InputGroup.Text>
                      <Form.Control
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="modern-form-control"
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-medium">{t('profile.phone')}</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="bg-light">
                        <Phone size={16} />
                      </InputGroup.Text>
                      <Form.Control
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder={t('profile.phonePlaceholder')}
                        className="modern-form-control"
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-medium">{t('profile.username')}</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="bg-light">
                        <User size={16} />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        value={currentUser?.username || ''}
                        disabled
                        className="modern-form-control bg-light"
                      />
                    </InputGroup>
                    <Form.Text className="text-muted">
                      {t('profile.usernameCannotChange')}
                    </Form.Text>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-medium">{t('profile.role')}</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="bg-light">
                        <Building size={16} />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        value={currentUser?.role ? getRoleDisplayName(currentUser.role) : ''}
                        disabled
                        className="modern-form-control bg-light"
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
              </Row>
            </div>
          </div>
          
          <Row className="g-4 mb-4">
            {/* Change Profile Card */}
            <Col md={6}>
              <div className="modern-card h-100">
                <div className="p-4">
                  <h5 className="fw-bold mb-2">{t('profile.changeAvatar')}</h5>
                  
                  <div className="text-center">
                    <div className="profile-picture-container mb-3">
                      {profilePicture ? (
                        <img
                          src={URL.createObjectURL(profilePicture)}
                          alt="Profile"
                          className="profile-picture"
                        />
                      ) : currentUser?.profile_picture ? (
                        <img
                          src={currentUser.profile_picture.startsWith('http') ? currentUser.profile_picture : `${getUploadsBaseURL()}${currentUser.profile_picture}`}
                          alt="Profile"
                          className="profile-picture"
                          onError={(e) => {
                            if (e.target && e.target.style) {
                              e.target.style.display = 'none';
                            }
                            if (e.target && e.target.nextSibling && e.target.nextSibling.style) {
                              e.target.nextSibling.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      {(!profilePicture && !currentUser?.profile_picture) && (
                        <div className="profile-picture-placeholder" style={{ 
                          display: 'flex', 
                          width: '120px', 
                          height: '120px', 
                          borderRadius: '50%', 
                          backgroundColor: '#f3f4f6',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto'
                        }}>
                          <User size={48} className="text-muted" />
                        </div>
                      )}
                    </div>
                    
                    <div className="d-flex gap-2 justify-content-center mb-3">
                      <label className="btn-modern" style={{ backgroundColor: '#256176' }}>
                        <Upload size={16} />
                        <span>{t('profile.upload')}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/gif,image/png"
                          onChange={handleProfilePictureUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                    
                    <p className="text-muted small mb-0">
                      {t('profile.avatarAllowedFormats')}
                    </p>
                  </div>
                </div>
              </div>
            </Col>

            {/* Face Recognition Card */}
            <Col md={6}>
              <div className="modern-card h-100">
                <div className="p-4">
                  <h5 className="fw-bold mb-0">{t('profile.faceRecognition')}</h5>
                  
                  {faceCaptureError && (
                    <div className="modern-alert modern-alert-danger mb-3">
                      <div className="d-flex align-items-center">
                        <AlertTriangle size={16} className="me-2 text-danger" />
                        <div className="small">{faceCaptureError}</div>
                      </div>
                    </div>
                  )}

                  {faceCaptureSuccess && (
                    <div className="modern-alert modern-alert-success mb-3">
                      <div className="d-flex align-items-center">
                        <CheckCircle size={16} className="me-2 text-success" />
                        <div className="small">{faceCaptureSuccess}</div>
                      </div>
                    </div>
                  )}

                  {faceSampleStatus ? (
                    <div>
                      {/* Face Sample Info Card */}
                      <div className="mb-3 p-3 bg-light rounded" style={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                        {/* Face Sample Image */}
                        {faceSampleImage && (
                          <div className="mb-3 text-center">
                            <div className="position-relative d-inline-block">
                              <img
                                src={faceSampleImage.startsWith('http') 
                                  ? faceSampleImage 
                                  : `${getUploadsBaseURL()}${faceSampleImage}`}
                                alt="Face Sample"
                                onClick={() => setShowImageModal(true)}
                                style={{
                                  width: '200px',
                                  height: '200px',
                                  objectFit: 'cover',
                                  borderRadius: '8px',
                                  border: '2px solid #256176',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                  cursor: 'pointer',
                                  transition: 'transform 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (e.target && e.target.style) {
                                    e.target.style.transform = 'scale(1.05)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (e.target && e.target.style) {
                                    e.target.style.transform = 'scale(1)';
                                  }
                                }}
                                onError={(e) => {
                                  if (e.target && e.target.style) {
                                    e.target.style.display = 'none';
                                  }
                                }}
                              />
                              {/* CheckCircle icon in top-right corner */}
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '-20px',
                                  right: '-20px',
                                  borderRadius: '50%',
 
                                }}
                              >
                                <CheckCircle size={50} style={{ color: '#10b981' }} />
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Registration Date */}
                        {faceSampleRegisteredAt && (
                          <div className="text-muted small text-center d-flex align-items-center justify-content-center gap-1">
                            <Calendar size={14} />
                            <span>
                              {t('profile.registeredAt')}: {new Date(faceSampleRegisteredAt).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Update Button - Only show if has pending request from clinical_admin */}
                      {hasPendingUpdateRequest ? (
                        <div className="text-center">
                          {pendingRequestType === 'force' ? (
                            <div className="modern-alert modern-alert-warning mb-3">
                              <div className="d-flex align-items-center">
                                <AlertTriangle size={16} className="me-2 text-warning" />
                                <div className="small">
                                  <strong>{t('profile.updateFaceSampleRequired')}:</strong> {t('profile.updateFaceSampleRequiredDesc')}
                                </div>
                              </div>
                            </div>
                          ) : pendingRequestType === 'user_request' ? (
                            <div className="modern-alert modern-alert-info mb-3">
                              <div className="d-flex align-items-center">
                                <AlertTriangle size={16} className="me-2 text-info" />
                                <div className="small">
                                  <strong>{t('profile.updateRequestPending')}</strong>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="modern-alert modern-alert-info mb-3">
                              <div className="d-flex align-items-center">
                                <CheckCircle size={16} className="me-2 text-info" />
                                <div className="small">
                                  <strong>{t('profile.updateAllowed')}:</strong> {t('profile.updateAllowedDesc')}
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Only show update button if request type is 'force' or 'allow', not 'user_request' */}
                          {pendingRequestType !== 'user_request' && (
                            <button
                              type="button"
                              className="btn-modern"
                              onClick={openFaceModal}
                              disabled={isCapturingFace}
                              style={{ backgroundColor: pendingRequestType === 'force' ? '#ff9800' : '#256176' }}
                            >
                              <div className="d-flex align-items-center gap-2">
                                <RotateCcw size={16} />
                                <span>{pendingRequestType === 'force' ? t('profile.updateFaceSampleRequiredBtn') : t('profile.updateFaceSample')}</span>
                              </div>
                            </button>
                          )}
                        </div>
                      ) : canReregister ? (
                        <div className="text-center">
                          <button
                            type="button"
                            className="btn-modern"
                            onClick={openFaceModal}
                            disabled={isCapturingFace}
                            style={{ backgroundColor: '#256176' }}
                          >
                            <div className="d-flex align-items-center gap-2">
                              <RotateCcw size={16} />
                              <span>{t('profile.reregister')}</span>
                            </div>
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <button
                            type="button"
                            className="btn-modern"
                            onClick={handleRequestFaceReset}
                            disabled={isCapturingFace}
                            style={{ backgroundColor: '#256176' }}
                          >
                            <div className="d-flex align-items-center gap-2">
                              <RotateCcw size={16} />
                              <span>{t('profile.requestFaceReset')}</span>
                            </div>
                          </button>
                          <p className="text-muted small mt-2 mb-0">
                            {t('profile.requestFaceResetDesc')}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center" style={{ marginTop: '-44px' }}>
                      <div className="d-flex flex-column align-items-center" style={{ gap: '4px' }}>
                        <div className="d-inline-flex align-items-center justify-content-center" style={{ lineHeight: 0, marginBottom: '-46px' }}>
                          <dotlottie-wc src={`${process.env.PUBLIC_URL || ''}/icon_animation_lottie/face_recognition.lottie`} autoplay loop style={{ width: '240px', height: '240px', display: 'block', verticalAlign: 'top' }} />
                        </div>
                        <button
                          type="button"
                          className="btn-modern"
                          onClick={openFaceModal}
                          disabled={isCapturingFace}
                          style={{ backgroundColor: '#256176' }}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <Upload size={16} />
                            <span>{t('profile.registerFaceSample')}</span>
                          </div>
                        </button>
                        <p className="text-muted small mb-0">
                          {t('profile.faceSampleDesc')}
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </Col>

            {/* Change Password Card */}
            <Col md={6}>
              <div className="modern-card h-100">
                <div className="p-4">
                  <h5 className="fw-bold mb-2">{t('profile.changePassword')}</h5>
                  <p className="text-muted small mb-4">{t('profile.changePasswordDesc')}</p>
                  
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <span className="fw-medium">{t('profile.enablePasswordChange')}</span>
                    <Form.Check
                      type="switch"
                      id="change-password"
                      checked={showPasswordFields}
                      onChange={() => setShowPasswordFields(!showPasswordFields)}
                    />
                  </div>
                  
                  {showPasswordFields && (
                    <div className="space-y-3">
                      <Form.Group>
                        <Form.Label className="fw-medium">{t('profile.currentPassword')}</Form.Label>
                        <InputGroup>
                          <InputGroup.Text className="bg-light">
                            <Lock size={16} />
                          </InputGroup.Text>
                          <Form.Control
                            type={showCurrentPassword ? "text" : "password"}
                            name="currentPassword"
                            value={formData.currentPassword}
                            onChange={handleChange}
                            placeholder={t('profile.currentPasswordPlaceholder')}
                            className="modern-form-control"
                          />
                          <button 
                            type="button"
                            className="btn-modern"
                            onClick={toggleShowCurrentPassword}
                            style={{ backgroundColor: '#6b7280', padding: '8px 12px' }}
                          >
                            {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </InputGroup>
                      </Form.Group>
                      
                      <Form.Group>
                        <Form.Label className="fw-medium">{t('profile.newPassword')}</Form.Label>
                        <InputGroup>
                          <InputGroup.Text className="bg-light">
                            <Lock size={16} />
                          </InputGroup.Text>
                          <Form.Control
                            type={showNewPassword ? "text" : "password"}
                            name="newPassword"
                            value={formData.newPassword}
                            onChange={handleChange}
                            placeholder={t('profile.newPasswordPlaceholder')}
                            minLength="6"
                            className="modern-form-control"
                          />
                          <button 
                            type="button"
                            className="btn-modern"
                            onClick={toggleShowNewPassword}
                            style={{ backgroundColor: '#6b7280', padding: '8px 12px' }}
                          >
                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </InputGroup>
                        
                        <div className="password-strength-bar mt-2">
                          <ProgressBar 
                            now={passwordStrength.score * 20} 
                            variant={getPasswordStrengthColor(passwordStrength.score)} 
                            label={getPasswordStrengthLabel(passwordStrength.score)}
                          />
                        </div>
                        
                        <div className="password-requirements mt-2">
                          <small className={`d-block ${passwordStrength.hasMinLength ? 'text-success' : 'text-muted'}`}>
                            <i className={`fas ${passwordStrength.hasMinLength ? 'fa-check-circle' : 'fa-circle'} me-1`}></i>
                            {t('profile.passwordRequirements.minLength')}
                          </small>
                          <small className={`d-block ${passwordStrength.hasUpperCase ? 'text-success' : 'text-muted'}`}>
                            <i className={`fas ${passwordStrength.hasUpperCase ? 'fa-check-circle' : 'fa-circle'} me-1`}></i>
                            {t('profile.passwordRequirements.uppercase')}
                          </small>
                          <small className={`d-block ${passwordStrength.hasLowerCase ? 'text-success' : 'text-muted'}`}>
                            <i className={`fas ${passwordStrength.hasLowerCase ? 'fa-check-circle' : 'fa-circle'} me-1`}></i>
                            {t('profile.passwordRequirements.lowercase')}
                          </small>
                          <small className={`d-block ${passwordStrength.hasNumber ? 'text-success' : 'text-muted'}`}>
                            <i className={`fas ${passwordStrength.hasNumber ? 'fa-check-circle' : 'fa-circle'} me-1`}></i>
                            {t('profile.passwordRequirements.number')}
                          </small>
                          <small className={`d-block ${passwordStrength.hasSpecialChar ? 'text-success' : 'text-muted'}`}>
                            <i className={`fas ${passwordStrength.hasSpecialChar ? 'fa-check-circle' : 'fa-circle'} me-1`}></i>
                            {t('profile.passwordRequirements.specialChar')}
                          </small>
                        </div>
                      </Form.Group>
                      
                      <Form.Group>
                        <Form.Label className="fw-medium">{t('profile.confirmPassword')}</Form.Label>
                        <InputGroup>
                          <InputGroup.Text className="bg-light">
                            <Lock size={16} />
                          </InputGroup.Text>
                          <Form.Control
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder={t('profile.confirmPasswordPlaceholder')}
                            minLength="6"
                            className="modern-form-control"
                          />
                          <button 
                            type="button"
                            className="btn-modern"
                            onClick={toggleShowConfirmPassword}
                            style={{ backgroundColor: '#6b7280', padding: '8px 12px' }}
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </InputGroup>
                      </Form.Group>
                    </div>
                  )}
                </div>
              </div>
            </Col>
          </Row>

          {/* Action Buttons */}
          <div className="d-flex justify-content-end gap-3">
            <button 
              type="button"
              className="btn-modern"
              style={{ backgroundColor: '#dc3545' }}
            >
              {t('common.cancel')}
            </button>
            <button 
              className="btn-modern"
              type="submit" 
              disabled={loading || (showPasswordFields && !isPasswordValid())}
            >
              {loading ? (
                <div className="d-flex align-items-center gap-2">
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">{t('common.loading')}</span>
                  </div>
                  <span>{t('profile.processing')}</span>
                </div>
              ) : (
                <div className="d-flex align-items-center gap-2">
                  <Save size={18} />
                  <span>{t('profile.saveChanges')}</span>
                </div>
              )}
            </button>
          </div>
        </Form>

        {/* Face Registration Modal */}
        <Modal 
          show={showFaceModal} 
          onHide={closeFaceModal}
          size="lg"
          centered
          backdrop="static"
        >
          <Modal.Body className="px-4 pb-4">
            <div className="text-center">
              {/* Step indicator */}
              {(captureStep === 'liveness' || captureStep === 'action' || captureStep === 'capturing' || captureStep === 'uploading') && (
                <div className="mb-3">
                  <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`rounded-circle d-flex align-items-center justify-content-center ${
                          livenessStep >= step ? 'bg-primary text-white' : 'bg-light text-muted'
                        }`}
                        style={{
                          width: '35px',
                          height: '35px',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}
                      >
                        {step}
                      </div>
                    ))}
                  </div>
                  <div className="text-muted small">
                    {livenessStep === 1 && t('profile.faceCapture.stepIndicator1')}
                    {livenessStep === 2 && t('profile.faceCapture.stepIndicator2')}
                    {livenessStep === 3 && t('profile.faceCapture.stepIndicator3')}
                  </div>
                </div>
              )}

              {/* Action instruction overlay for step 2 */}
              {captureStep === 'action' && requiredAction && (
                <div className="alert alert-info mb-3" role="alert">
                  <div className="d-flex align-items-center">
                    <i className={`fas fa-smile me-2`} style={{ fontSize: '24px' }}></i>
                    <div>
                      <strong>{t('profile.faceCapture.actionInstruction')}</strong>
                      <div className="mt-1">
                        {t('profile.faceCapture.actionMouth')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Camera Preview - Always visible */}
              <div className="position-relative d-inline-block mb-3" style={{ maxWidth: '100%' }}>
                <video
                  ref={videoElementRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    maxWidth: '640px',
                    height: 'auto',
                    borderRadius: '8px',
                    backgroundColor: '#000',
                    display: captureStep === 'success' || captureStep === 'error' ? 'none' : 'block'
                  }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                {/* Overlay for liveness, action, capturing/uploading */}
                {(captureStep === 'liveness' || captureStep === 'action' || captureStep === 'capturing' || captureStep === 'uploading') && (
                  <div 
                    className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.6)',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                  >
                    <div className="spinner-border text-white mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <h6 className="text-white mb-2">
                      {captureStep === 'liveness' && t('profile.faceCapture.moveHead')}
                      {captureStep === 'action' && t('profile.faceCapture.openMouth')}
                      {captureStep === 'capturing' && t('profile.faceCapture.capturing')}
                      {captureStep === 'uploading' && t('profile.faceCapture.uploading')}
                    </h6>
                    <ProgressBar 
                      now={captureProgress} 
                      className="mb-2" 
                      style={{ 
                        height: '8px', 
                        width: '80%',
                        backgroundColor: 'rgba(255, 255, 255, 0.3)'
                      }}
                      variant="info"
                    />
                    <p className="text-white-50 small mb-0">
                      {captureStep === 'liveness' && t('profile.faceCapture.checkingMotion')}
                      {captureStep === 'action' && t('profile.faceCapture.detectingAction')}
                      {captureStep === 'capturing' && t('profile.faceCapture.holdPosition')}
                      {captureStep === 'uploading' && t('profile.faceCapture.extractingFeatures')}
                    </p>
                  </div>
                )}
              </div>

              {/* Preview Step */}
              {captureStep === 'preview' && (
                <>
                  <p className="text-muted small mb-3">
                    {t('profile.faceCapture.ensureFaceInFrame')}
                  </p>
                  <div className="d-flex gap-2 justify-content-center">
                    <button
                      type="button"
                      className="btn-modern"
                      onClick={closeFaceModal}
                      style={{ backgroundColor: '#6b7280' }}
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      className="btn-modern"
                      onClick={captureFaceSample}
                      style={{ backgroundColor: '#256176' }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <Camera size={18} />
                        <span>{t('profile.faceCapture.scanFace')}</span>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* Success Step */}
              {captureStep === 'success' && (
                <div className="py-3">
                  <div className="rounded-circle bg-success bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                    <CheckCircle size={40} className="text-success" />
                  </div>
                  <h6 className="text-success mb-2">{t('profile.faceCapture.registrationSuccess')}</h6>
                  <p className="text-muted small mb-3">{faceCaptureSuccess}</p>
                  
                  {/* Show registered image */}
                  {registeredFaceImage && (
                    <div className="mb-3">
                      <img
                        src={registeredFaceImage.startsWith('http') 
                          ? registeredFaceImage 
                          : `${window.location.origin}${registeredFaceImage}`}
                        alt="Registered Face"
                        style={{
                          width: '100%',
                          maxWidth: '400px',
                          height: 'auto',
                          borderRadius: '8px',
                          border: '2px solid #10b981',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                        onError={(e) => {
                          if (e.target && e.target.style) {
                            e.target.style.display = 'none';
                          }
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  <div className="d-flex gap-2 justify-content-center mt-3">
                    <button
                      type="button"
                      className="btn-modern"
                      onClick={handleReregister}
                      style={{ backgroundColor: '#256176' }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <RotateCcw size={16} />
                        <span>{t('profile.reregister')}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="btn-modern"
                      onClick={handleComplete}
                      style={{ backgroundColor: '#10b981' }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <CheckCircle size={16} />
                        <span>{t('profile.faceCapture.complete')}</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Error Step */}
              {captureStep === 'error' && (
                <div className="py-3">
                  <div className="rounded-circle bg-danger bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                    <AlertTriangle size={40} className="text-danger" />
                  </div>
                  <h6 className="text-danger mb-2">{t('profile.faceCapture.registrationFailed')}</h6>
                  <Alert variant="danger" className="mb-3">
                    {faceCaptureError || t('profile.errors.genericError')}
                  </Alert>
                  <div className="d-flex gap-2 justify-content-center">
                    <button
                      type="button"
                      className="btn-modern"
                      onClick={closeFaceModal}
                      style={{ backgroundColor: '#6b7280' }}
                    >
                      {t('common.close')}
                    </button>
                    <button
                      type="button"
                      className="btn-modern"
                      onClick={() => {
                        setCaptureStep('preview');
                        setFaceCaptureError('');
                        startCamera();
                      }}
                      style={{ backgroundColor: '#256176' }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <RefreshCcw size={16} />
                        <span>{t('profile.faceCapture.tryAgain')}</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Modal.Body>
          </Modal>

          {/* Image Preview Modal */}
          <Modal 
            show={showImageModal} 
            onHide={() => setShowImageModal(false)}
            centered
            size="lg"
            className="image-preview-modal"
          >
            <Modal.Header closeButton style={{ border: 'none', paddingBottom: '0' }}>
              <Modal.Title>{t('profile.faceCapture.registeredFaceSample')}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="text-center p-4">
              {faceSampleImage && (
                <img
                  src={faceSampleImage.startsWith('http') 
                    ? faceSampleImage 
                    : `${getUploadsBaseURL()}${faceSampleImage}`}
                  alt="Face Sample - Full Size"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                  onError={(e) => {
                    if (e.target && e.target.style) {
                      e.target.style.display = 'none';
                    }
                  }}
                />
              )}
            </Modal.Body>
          </Modal>
        </Container>
      </div>
    );
  };
  
  export default ProfilePage;