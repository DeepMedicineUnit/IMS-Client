import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, Button, Form, Alert, Container, Row, Col, Spinner, Modal, ProgressBar } from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { format, parseISO, isAfter, isBefore, isEqual } from 'date-fns';
import { Loader2, RefreshCcw, MapPin, Clock, Calendar, User, Lock, CheckCircle, Camera } from "lucide-react";
import { GoogleLogin } from '@react-oauth/google';
import { trackAttendance, trackQRCodeScan, trackError } from '../../utils/analytics';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/modern-ui.css';
import { useHospitalLocations, findHospitalByCoordinates } from '../../hooks/useHospitalLocations';
import { checkVPNStatus, getCommonVPNApps } from '../../utils/vpnDetection';
import { useTranslation } from 'react-i18next';
import { getApiBaseURL } from '../../utils/api';

// Custom hook for polling at intervals
const useInterval = (callback, delay) => {
    const savedCallback = useRef();

    // Remember the latest callback
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Set up the interval
    useEffect(() => {
        function tick() {
            savedCallback.current();
        }
        if (delay !== null) {
            const id = setInterval(tick, delay);
            return () => clearInterval(id);
        }
    }, [delay]);

};

const AttendanceSession = ({ shared = false }) => {
    const { t } = useTranslation();
    usePageTitle(t('attendanceSession.title'));
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, isLoggedIn, api, googleLogin } = useAuth();
    const { hospitalLocations } = useHospitalLocations();
    const { showAlert } = useAlert();

    // State for auto-refresh
    const [refreshing, setRefreshing] = useState(false);

    // Tính toán trạng thái dựa trên ngày và thời gian
    const calculateSessionStatus = (session) => {
        try {
            const currentDate = new Date();
            const sessionStartDate = parseISO(session.date);
            const sessionEndDate = session.end_date ? parseISO(session.end_date) : sessionStartDate;

            // Chuẩn hóa ngày hiện tại để so sánh chỉ ngày
            const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
            const sessionStartDateOnly = new Date(sessionStartDate.getFullYear(), sessionStartDate.getMonth(), sessionStartDate.getDate());
            const sessionEndDateOnly = new Date(sessionEndDate.getFullYear(), sessionEndDate.getMonth(), sessionEndDate.getDate());

            // Kiểm tra nếu buổi học bị hủy
            if (session.status === 'cancelled') {
                return 'cancelled';
            }

            // Buổi học trong tương lai (chưa bắt đầu)
            if (isAfter(sessionStartDateOnly, currentDateOnly)) {
                return 'scheduled';
            }

            // Buổi học đã kết thúc (sau ngày kết thúc)
            if (isBefore(sessionEndDateOnly, currentDateOnly)) {
                return 'ended';
            }

            // Buổi học đang diễn ra (trong khoảng thời gian từ ngày bắt đầu đến ngày kết thúc)
            if ((isEqual(sessionStartDateOnly, currentDateOnly) || isAfter(currentDateOnly, sessionStartDateOnly)) &&
                (isEqual(sessionEndDateOnly, currentDateOnly) || isBefore(currentDateOnly, sessionEndDateOnly))) {

                // Nếu là ngày bắt đầu, kiểm tra thời gian bắt đầu
                if (isEqual(sessionStartDateOnly, currentDateOnly)) {
                    const startTimeParts = session.start_time.split(':');
                    const startTime = new Date(currentDate);
                    startTime.setHours(parseInt(startTimeParts[0]), parseInt(startTimeParts[1]), 0);

                    // Nếu chưa đến giờ bắt đầu
                    if (currentDate < startTime) {
                        return 'scheduled';
                    }
                }

                // Nếu là ngày kết thúc, kiểm tra thời gian kết thúc
                if (isEqual(sessionEndDateOnly, currentDateOnly)) {
                    const endTimeParts = session.end_time.split(':');
                    const endTime = new Date(currentDate);
                    endTime.setHours(parseInt(endTimeParts[0]), parseInt(endTimeParts[1]), 0);

                    // Nếu đã qua giờ kết thúc
                    if (currentDate > endTime) {
                        return 'ended';
                    }
                }

                // Nếu đang trong khoảng thời gian của session (đã bắt đầu và chưa kết thúc)
                return 'active';
            }

            // Mặc định giữ nguyên trạng thái
            return session.status;
        } catch (error) {
            console.error('Error calculating session status:', error);
            return session.status;
        }
    };

    // Check if the current time is within the allowed attendance window
    const checkAttendanceWindow = (session) => {
        const now = new Date();
        const sessionDate = parseISO(session.date);

        // Set year, month, day from session date
        const currentDate = new Date();
        currentDate.setFullYear(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());

        // Parse start and end times
        const [startHours, startMinutes] = session.start_time.split(':').map(Number);
        const [endHours, endMinutes] = session.end_time.split(':').map(Number);

        const sessionStartTime = new Date(currentDate);
        sessionStartTime.setHours(startHours, startMinutes, 0, 0);

        const sessionEndTime = new Date(currentDate);
        sessionEndTime.setHours(endHours, endMinutes, 0, 0);

        // Handle sessions that span across midnight
        if (sessionEndTime < sessionStartTime) {
            sessionEndTime.setDate(sessionEndTime.getDate() + 1);
        }

        // Check multiple attendance windows based on session configuration
        const attendanceConfig = session.monitoring_options?.attendance;

        // FIRST: Check if session has ended - this takes priority over all other logic
        if (now > sessionEndTime) {
            if (attendanceConfig?.after_session?.enabled) {
                const minutesAfter = attendanceConfig.after_session.minutes_after || 0;
                const duration = attendanceConfig.after_session.duration || 30;
                
                const afterStart = new Date(sessionEndTime);
                afterStart.setMinutes(afterStart.getMinutes() + minutesAfter);
                
                const afterEnd = new Date(afterStart);
                afterEnd.setMinutes(afterEnd.getMinutes() + duration);
                
                if (now >= afterStart && now <= afterEnd) {
                    return { allowed: true, type: 'after', message: t('attendanceSession.attendanceWindow.inAfterWindow') };
                } else if (now > afterEnd) {
                    const minutesLate = Math.round((now - afterEnd) / (1000 * 60));
                    return {
                        allowed: true,
                        type: 'late_leave',
                        minutesLate: minutesLate,
                        message: t('attendanceSession.attendanceWindow.lateLeaveMinutes', { minutes: minutesLate })
                    };
                } else {
                    const minutesToAfter = Math.round((afterStart - now) / (1000 * 60));
                    return {
                        allowed: false,
                        message: t('attendanceSession.attendanceWindow.sessionEnded', { 
                            time: `${afterStart.getHours()}:${afterStart.getMinutes().toString().padStart(2, '0')}`, 
                            minutes: minutesToAfter 
                        })
                    };
                }
            } else {
                return {
                    allowed: false,
                    message: t('attendanceSession.attendanceWindow.sessionEndedNoAfter')
                };
            }
        }

        if (!attendanceConfig) {
            // If no attendance config, just check if we're in the session time
            const calculatedStatus = calculateSessionStatus(session);
            if (calculatedStatus === 'active') {
                return { allowed: true, type: 'during' };
            } else if (calculatedStatus === 'scheduled') {
                // Calculate minutes until session starts
                const minutesToStart = Math.round((sessionStartTime - now) / (1000 * 60));
                return {
                    allowed: false,
                    message: t('attendanceSession.attendanceWindow.sessionStartsAt', { 
                        time: `${sessionStartTime.getHours()}:${sessionStartTime.getMinutes().toString().padStart(2, '0')}`, 
                        minutes: minutesToStart 
                    })
                };
            } else if (calculatedStatus === 'ended') {
                return { allowed: false, message: t('attendanceSession.attendanceWindow.sessionEndedCannotAttend') };
            } else {
                return { allowed: false, message: t('attendanceSession.attendanceWindow.sessionCancelled') };
            }
        }

        // Check before session attendance window
        if (attendanceConfig.before_session?.enabled) {
            const minutesBefore = attendanceConfig.before_session.minutes_before || 30;
            const duration = attendanceConfig.before_session.duration || 30;
            const maxLateMinutes = attendanceConfig.before_session.max_late_minutes || 30;

            const beforeStart = new Date(sessionStartTime);
            beforeStart.setMinutes(beforeStart.getMinutes() - minutesBefore);

            const beforeEnd = new Date(sessionStartTime); // Ends at session start
            const lateEnd = new Date(sessionStartTime);
            lateEnd.setMinutes(lateEnd.getMinutes() + maxLateMinutes); // Allow late attendance

            // Check if we're before the attendance window but on the same day
            if (now < beforeStart && now.getDate() === sessionStartTime.getDate()) {
                const minutesToWindow = Math.round((beforeStart - now) / (1000 * 60));
                return {
                    allowed: false,
                    type: 'too_early',
                    message: t('attendanceSession.attendanceWindow.tooEarly', { 
                        time: `${beforeStart.getHours()}:${beforeStart.getMinutes().toString().padStart(2, '0')}`, 
                        minutes: minutesToWindow 
                    })
                };
            }

            if (now >= beforeStart && now <= lateEnd) {
                // Within before-session window (including late attendance)
                if (now <= beforeEnd) {
                    // Within normal before-session window
                    const minutesEarly = Math.round((beforeEnd - now) / (1000 * 60));

                    if (minutesEarly > duration) {
                        return {
                            allowed: true,
                            type: 'early',
                            minutesEarly: minutesEarly,
                            message: t('attendanceSession.attendanceWindow.earlyMinutes', { minutes: minutesEarly })
                        };
                    }

                    return { allowed: true, type: 'before', message: t('attendanceSession.attendanceWindow.inBeforeWindow') };
                } else {
                    // Late attendance (after session start but within max_late_minutes)
                    const minutesLate = Math.round((now - sessionStartTime) / (1000 * 60));
                    return {
                        allowed: true,
                        type: 'late_before',
                        minutesLate: minutesLate,
                        message: t('attendanceSession.attendanceWindow.lateMinutesStillAllowed', { minutes: minutesLate })
                    };
                }
            } else if (now > lateEnd) {
                // Quá thời gian cho phép đi trễ, chuyển sang khung giờ tiếp theo
                const minutesLate = Math.round((now - sessionStartTime) / (1000 * 60));
                
                // Kiểm tra khung giờ during_session
                if (attendanceConfig.during_session?.enabled) {
                    const minutesAfterStart = attendanceConfig.during_session.minutes_after_start || 120;
                    const duringStart = new Date(sessionStartTime);
                    duringStart.setMinutes(duringStart.getMinutes() + minutesAfterStart);
                    
                    if (now >= duringStart) {
                        // Đã đến khung giờ during_session
                        return { allowed: true, type: 'during', message: t('attendanceSession.attendanceWindow.inDuringWindow') };
                    } else {
                        // Chưa đến khung giờ during_session
                        const minutesToDuring = Math.round((duringStart - now) / (1000 * 60));
                        return {
                            allowed: false,
                            message: t('attendanceSession.attendanceWindow.lateExceeded', { 
                                minutes: maxLateMinutes, 
                                time: `${duringStart.getHours()}:${duringStart.getMinutes().toString().padStart(2, '0')}`, 
                                minutesToDuring: minutesToDuring 
                            })
                        };
                    }
                } else {
                    // Không có during_session, kiểm tra after_session
                    if (attendanceConfig.after_session?.enabled) {
                        const minutesAfter = attendanceConfig.after_session.minutes_after || 0;
                        const afterStart = new Date(sessionEndTime);
                        afterStart.setMinutes(afterStart.getMinutes() + minutesAfter);
                        
                        if (now >= afterStart) {
                            return { allowed: true, type: 'after', message: t('attendanceSession.attendanceWindow.inAfterWindow') };
                        } else {
                            const minutesToAfter = Math.round((afterStart - now) / (1000 * 60));
                            return {
                                allowed: false,
                                message: t('attendanceSession.attendanceWindow.lateExceededAfter', { 
                                    minutes: maxLateMinutes, 
                                    time: `${afterStart.getHours()}:${afterStart.getMinutes().toString().padStart(2, '0')}`, 
                                    minutesToAfter: minutesToAfter 
                                })
                            };
                        }
                    } else {
                        // Không có khung giờ nào khác
                        return {
                            allowed: false,
                            message: t('attendanceSession.attendanceWindow.lateExceededNoMore', { minutes: maxLateMinutes })
                        };
                    }
                }
            }
        }

        // Check during session attendance window
        if (attendanceConfig.during_session?.enabled) {
            const minutesAfterStart = attendanceConfig.during_session.minutes_after_start || 120;
            const minutesBeforeEnd = attendanceConfig.during_session.minutes_before_end || 120;

            const duringStart = new Date(sessionStartTime);
            duringStart.setMinutes(duringStart.getMinutes() + minutesAfterStart);

            const duringEnd = new Date(sessionEndTime);
            duringEnd.setMinutes(duringEnd.getMinutes() - minutesBeforeEnd);

            if (now >= duringStart && now <= duringEnd) {
                // Within during-session window
                return { allowed: true, type: 'during', message: t('attendanceSession.attendanceWindow.inDuringWindow') };
            } else if (now > sessionStartTime && now < duringStart) {
                // Between session start and during-session start
                // Check if we're still within max_late_minutes from before_session
                const minutesLate = Math.round((now - sessionStartTime) / (1000 * 60));
                const maxLateMinutes = attendanceConfig.before_session?.max_late_minutes || 30;
                
                if (minutesLate <= maxLateMinutes) {
                    // Still within late allowance from before_session
                    return {
                        allowed: true,
                        type: 'late',
                        minutesLate: minutesLate,
                        message: t('attendanceSession.attendanceWindow.lateMinutes', { minutes: minutesLate })
                    };
                } else {
                    // Quá thời gian cho phép đi trễ, chờ đến khung giờ during_session
                    const minutesToDuring = Math.round((duringStart - now) / (1000 * 60));
                    return {
                        allowed: false,
                        message: t('attendanceSession.attendanceWindow.lateExceeded', { 
                            minutes: maxLateMinutes, 
                            time: `${duringStart.getHours()}:${duringStart.getMinutes().toString().padStart(2, '0')}`, 
                            minutesToDuring: minutesToDuring 
                        })
                    };
                }
            } else if (now > duringEnd && now < sessionEndTime) {
                // Between during-session end and session end
                // Check if after-session attendance is enabled
                if (attendanceConfig.after_session?.enabled) {
                    const minutesAfter = attendanceConfig.after_session.minutes_after || 0;
                    const afterStart = new Date(sessionEndTime);
                    afterStart.setMinutes(afterStart.getMinutes() + minutesAfter);

                    if (now < afterStart) {
                        // Too early for after-session, show when it will be available
                        const minutesToAfter = Math.round((afterStart - now) / (1000 * 60));
                        return {
                            allowed: false,
                            message: t('attendanceSession.attendanceWindow.duringWindowEnded', { 
                                time: `${afterStart.getHours()}:${afterStart.getMinutes().toString().padStart(2, '0')}`, 
                                minutes: minutesToAfter 
                            })
                        };
                    }
                } else {
                    // No after-session config, show that during-session window has ended
                    return {
                        allowed: false,
                        message: t('attendanceSession.attendanceWindow.duringWindowEndedNoAfter', { 
                            startTime: `${duringStart.getHours()}:${duringStart.getMinutes().toString().padStart(2, '0')}`, 
                            endTime: `${duringEnd.getHours()}:${duringEnd.getMinutes().toString().padStart(2, '0')}` 
                        })
                    };
                }
            }
        }

        // Check after session attendance window
        if (attendanceConfig.after_session?.enabled) {
            const minutesAfter = attendanceConfig.after_session.minutes_after || 0;
            const duration = attendanceConfig.after_session.duration || 30;

            const afterStart = new Date(sessionEndTime);
            afterStart.setMinutes(afterStart.getMinutes() + minutesAfter);

            const afterEnd = new Date(afterStart);
            afterEnd.setMinutes(afterEnd.getMinutes() + duration);

            if (now >= afterStart && now <= afterEnd) {
                // Within after-session window
                return { allowed: true, type: 'after', message: t('attendanceSession.attendanceWindow.inAfterWindow') };
            } else if (now > afterEnd) {
                // Too late for after-session window
                const minutesLate = Math.round((now - afterEnd) / (1000 * 60));
                return {
                    allowed: true,
                    type: 'late_leave',
                    minutesLate: minutesLate,
                    message: `Bạn về trễ ${minutesLate} phút sau khung giờ điểm danh`
                };
            } else if (now > sessionEndTime && now < afterStart) {
                // Between session end and after-session start
                return {
                    allowed: false,
                    message: t('attendanceSession.attendanceWindow.mustAttendInWindow', { 
                        startTime: `${afterStart.getHours()}:${afterStart.getMinutes().toString().padStart(2, '0')}`, 
                        endTime: `${afterEnd.getHours()}:${afterEnd.getMinutes().toString().padStart(2, '0')}` 
                    })
                };
            }
        }

        // If session has started but not ended, and no during-session config
        if (now >= sessionStartTime && now <= sessionEndTime) {
            // Check if after-session attendance is enabled and we're past the during-session window
            if (attendanceConfig.after_session?.enabled) {
                const minutesAfter = attendanceConfig.after_session.minutes_after || 0;
                const afterStart = new Date(sessionEndTime);
                afterStart.setMinutes(afterStart.getMinutes() + minutesAfter);

                if (now < afterStart) {
                    // Too early for after-session, show when it will be available
                    const minutesToAfter = Math.round((afterStart - now) / (1000 * 60));
                    return {
                        allowed: false,
                        message: t('attendanceSession.attendanceWindow.beforeWindowEnded', { 
                            time: `${afterStart.getHours()}:${afterStart.getMinutes().toString().padStart(2, '0')}`, 
                            minutes: minutesToAfter 
                        })
                    };
                }
            }

            // Check if late
            const minutesLate = Math.round((now - sessionStartTime) / (1000 * 60));

            if (minutesLate > 0) {
                return {
                    allowed: true,
                    type: 'late',
                    minutesLate: minutesLate,
                    message: t('attendanceSession.attendanceWindow.lateMinutes', { minutes: minutesLate })
                };
            }

            return { allowed: true, type: 'during', message: t('attendanceSession.attendanceWindow.inSessionTime') };
        }

        // Default response if none of the above conditions are met
        const calculatedStatus = calculateSessionStatus(session);

        // Provide more specific guidance based on attendance windows
        if (calculatedStatus === 'scheduled') {
            // If before-session attendance is enabled, check if we're in that window
            if (attendanceConfig.before_session?.enabled) {
                const beforeStart = new Date(sessionStartTime);
                beforeStart.setMinutes(beforeStart.getMinutes() - (attendanceConfig.before_session.minutes_before || 30));

                // If we're already past the before-session start time, we should be able to attend
                if (now >= beforeStart) {
                    // This case is already handled by the before_session check above
                    // If we get here, it means we're in the window but the specific check didn't catch it
                    const minutesEarly = Math.round((sessionStartTime - now) / (1000 * 60));
                    return {
                        allowed: true,
                        type: 'before',
                        minutesEarly: minutesEarly,
                        message: t('attendanceSession.attendanceWindow.inBeforeWindow')
                    };
                } else {
                    // We're before the before-session window
                    const minutesToWindow = Math.round((beforeStart - now) / (1000 * 60));
                    return {
                        allowed: false,
                        message: t('attendanceSession.attendanceWindow.beforeWindowStarts', { 
                            time: `${beforeStart.getHours()}:${beforeStart.getMinutes().toString().padStart(2, '0')}`, 
                            minutes: minutesToWindow 
                        })
                    };
                }
            }

            // No before-session window, just show when the session starts
            const minutesToStart = Math.round((sessionStartTime - now) / (1000 * 60));
            return {
                allowed: false,
                message: t('attendanceSession.attendanceWindow.sessionStartsAt', { 
                    time: `${sessionStartTime.getHours()}:${sessionStartTime.getMinutes().toString().padStart(2, '0')}`, 
                    minutes: minutesToStart 
                })
            };
        } else if (calculatedStatus === 'ended') {
            if (attendanceConfig.after_session?.enabled) {
                const afterStart = new Date(sessionEndTime);
                afterStart.setMinutes(afterStart.getMinutes() + (attendanceConfig.after_session.minutes_after || 0));

                const afterEnd = new Date(afterStart);
                afterEnd.setMinutes(afterEnd.getMinutes() + (attendanceConfig.after_session.duration || 30));

                // If after session window is in the future
                if (now < afterStart) {
                    const minutesToAfter = Math.round((afterStart - now) / (1000 * 60));
                    return {
                        allowed: false,
                        message: t('attendanceSession.attendanceWindow.sessionEnded', { 
                            time: `${afterStart.getHours()}:${afterStart.getMinutes().toString().padStart(2, '0')}`, 
                            minutes: minutesToAfter 
                        })
                    };
                }
                // If we're within the after session window
                else if (now >= afterStart && now <= afterEnd) {
                    return { allowed: true, type: 'after', message: t('attendanceSession.attendanceWindow.inAfterWindow') };
                }
                // If after session window has passed
                else if (now > afterEnd) {
                    const minutesLate = Math.round((now - afterEnd) / (1000 * 60));
                    return {
                        allowed: true,
                        type: 'late_leave',
                        minutesLate: minutesLate,
                        message: t('attendanceSession.attendanceWindow.lateLeaveMinutes', { minutes: minutesLate })
                    };
                }
            } else {
                return {
                    allowed: false,
                    message: t('attendanceSession.attendanceWindow.sessionEndedNoAfter')
                };
            }
        } else {
            return { allowed: false, message: t('attendanceSession.attendanceWindow.sessionCancelled') };
        }
    };

    // Helper function to check if duty student checkbox should be shown
    // Only show during the "during_session" window: 120 phút sau giờ bắt đầu và 120 phút trước giờ kết thúc
    const canShowDutyStudentCheckbox = () => {
        if (!session || !isLoggedIn || success) {
            return false;
        }
        
        // Don't show if session is cancelled
        if (session.status === 'cancelled') {
            return false;
        }
        
        try {
            const now = new Date();
            const sessionDate = parseISO(session.date);
            
            // Set year, month, day from session date
            const currentDate = new Date();
            currentDate.setFullYear(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
            
            // Parse start and end times
            const [startHours, startMinutes] = session.start_time.split(':').map(Number);
            const [endHours, endMinutes] = session.end_time.split(':').map(Number);
            
            const sessionStartTime = new Date(currentDate);
            sessionStartTime.setHours(startHours, startMinutes, 0, 0);
            
            const sessionEndTime = new Date(currentDate);
            sessionEndTime.setHours(endHours, endMinutes, 0, 0);
            
            // Handle sessions that span across midnight
            if (sessionEndTime < sessionStartTime) {
                sessionEndTime.setDate(sessionEndTime.getDate() + 1);
            }
            
            // Calculate during_session window: 120 phút sau giờ bắt đầu và 120 phút trước giờ kết thúc
            const minutesAfterStart = 120;
            const minutesBeforeEnd = 120;
            
            const duringStart = new Date(sessionStartTime);
            duringStart.setMinutes(duringStart.getMinutes() + minutesAfterStart);
            
            const duringEnd = new Date(sessionEndTime);
            duringEnd.setMinutes(duringEnd.getMinutes() - minutesBeforeEnd);
            
            // Only show checkbox if current time is within the during_session window
            return now >= duringStart && now <= duringEnd;
        } catch (error) {
            console.error('Error checking duty student checkbox visibility:', error);
            return false;
        }
    };

    // Parse token from URL
    const searchParams = new URLSearchParams(location.search);
    const tokenFromURL = searchParams.get('token');

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [session, setSession] = useState(null);
    const [password, setPassword] = useState('');
    const [token, setToken] = useState(tokenFromURL || '');
    const [locationData, setLocationData] = useState(null);
    const [hasLocationPermission, setHasLocationPermission] = useState(false);
    const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [currentAttendanceWindow, setCurrentAttendanceWindow] = useState(null);
    
    // VPN Detection state
    const [vpnStatus, setVpnStatus] = useState(null);
    const [isCheckingVPN, setIsCheckingVPN] = useState(false);
    const [vpnCheckError, setVpnCheckError] = useState('');

    // Face verification settings
    const [faceVerificationEnabled, setFaceVerificationEnabled] = useState(true);
    const faceVerificationEnabledRef = useRef(true);
    
    // Update ref when state changes
    useEffect(() => {
        faceVerificationEnabledRef.current = faceVerificationEnabled;
    }, [faceVerificationEnabled]);
    
    // Face verification modal states
    const [showFaceVerificationModal, setShowFaceVerificationModal] = useState(false);
    const [faceVerificationStep, setFaceVerificationStep] = useState('preview'); // 'preview', 'liveness', 'action', 'capturing', 'verifying', 'success', 'error', 'retry'
    const [faceVerificationProgress, setFaceVerificationProgress] = useState(0);
    const [faceVerificationMessage, setFaceVerificationMessage] = useState('');
    const [faceVerificationAttempt, setFaceVerificationAttempt] = useState(0);
    const [faceVerificationMaxAttempts] = useState(2);
    const [livenessStep, setLivenessStep] = useState(1); // 1: liveness, 2: action, 3: face detection, 4: face recognition
    const [requiredAction, setRequiredAction] = useState(null); // 'mouth' only
    const [previousFrame, setPreviousFrame] = useState(null);
    const [detectedBbox, setDetectedBbox] = useState(null);
    const faceVerificationVideoRef = useRef(null);
    const faceVerificationCanvasRef = useRef(null);
    const faceVerificationStreamRef = useRef(null);

    // Face sample status
    const [hasFaceSample, setHasFaceSample] = useState(null); // null = checking, true = has, false = doesn't have
    const [showFaceSampleRequiredModal, setShowFaceSampleRequiredModal] = useState(false);
    
    // State for duty student self-registration during session
    const [isDutyStudent, setIsDutyStudent] = useState(false);

    // Removed student information form fields as login is now required

    // Function to check VPN status
    const checkVPNStatusForAttendance = async () => {
        try {
            setIsCheckingVPN(true);
            setVpnCheckError('');
            
            const result = await checkVPNStatus();
            setVpnStatus(result);
            
        } catch (error) {
            console.error('Error checking VPN status:', error);
            setVpnCheckError('Không thể kiểm tra trạng thái VPN. Vui lòng thử lại.');
            setVpnStatus({
                isVPN: false,
                isProxy: false,
                confidence: 0,
                message: 'Không thể kiểm tra trạng thái VPN',
                severity: 'error'
            });
        } finally {
            setIsCheckingVPN(false);
        }
    };

    // Function to check location permission status quickly
    const checkLocationPermissionStatus = () => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve({ supported: false, permission: 'denied' });
                return;
            }

            // Quick check with very short timeout to detect if location is disabled
            navigator.geolocation.getCurrentPosition(
                () => resolve({ supported: true, permission: 'granted' }),
                (error) => {
                    if (error.code === 1) { // PERMISSION_DENIED
                        resolve({ supported: true, permission: 'denied' });
                    } else if (error.code === 2) { // POSITION_UNAVAILABLE
                        resolve({ supported: true, permission: 'unavailable' });
                    } else {
                        resolve({ supported: true, permission: 'unknown' });
                    }
                },
                { 
                    enableHighAccuracy: false, 
                    timeout: 2000, // Very short timeout for quick check
                    maximumAge: 0 
                }
            );
        });
    };

    // Function to manually retry location detection with improved retry mechanism
    const retryLocationDetection = async () => {
        if (!navigator.geolocation) {
            setError(t('attendanceSession.location.notSupported'));
            return;
        }

        // Skip location check if VPN/Proxy is detected
        if (vpnStatus && (vpnStatus.isVPN || vpnStatus.isProxy)) {
            setError(t('attendanceSession.location.cannotRetryVPN'));
            return;
        }

        setIsGettingLocation(true);
        setError('');
        setLocationPermissionDenied(false);
        
        try {
            // First, do a quick permission check
            const permissionStatus = await checkLocationPermissionStatus();
            
            if (!permissionStatus.supported) {
                setError(t('attendanceSession.location.notSupported'));
                setIsGettingLocation(false);
                return;
            }
            
            if (permissionStatus.permission === 'denied') {
                setError('Quyền truy cập vị trí bị từ chối. Vui lòng bật định vị và cấp quyền truy cập.');
                setLocationPermissionDenied(true);
                setIsGettingLocation(false);
                return;
            }
            
            if (permissionStatus.permission === 'unavailable') {
                setError('Định vị GPS không khả dụng. Vui lòng kiểm tra cài đặt định vị trên thiết bị.');
                setIsGettingLocation(false);
                return;
            }
            
            const position = await getLocationWithFallback();
            const currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            
            setLocationData(currentLocation);
            setHasLocationPermission(true);
            setLocationPermissionDenied(false);
            setIsGettingLocation(false);
            setError(''); // Clear any previous errors
            
            
            // Check geofence if enabled
            if (session?.monitoring_options?.location?.geofence?.enabled) {
                const geofence = session.monitoring_options.location.geofence;
                const withinGeofence = isWithinGeofence(currentLocation, geofence);
                
                if (!withinGeofence) {
                    if (session.monitoring_options?.location?.enforcement === 'immediate') {
                        setError(t('attendanceSession.location.outsideRange', { radius: geofence.radius }));
                    }
                } else {
                    // Clear any geofence errors if user is now within range
                    if (error && error.includes('ngoài phạm vi')) {
                        setError('');
                    }
                }
            }
        } catch (error) {
            console.error('Error retrying location after all attempts:', error);
            setIsGettingLocation(false);
            setHasLocationPermission(false);
            
            if (error.code === 1) { // PERMISSION_DENIED
                setLocationPermissionDenied(true);
                setError('Quyền truy cập vị trí bị từ chối. Vui lòng cấp quyền và thử lại.');
            } else if (error.code === 3) { // TIMEOUT
                setError('Không thể xác định vị trí sau nhiều lần thử. Vui lòng kiểm tra cài đặt GPS và thử lại sau vài giây.');
            } else if (error.code === 2) { // POSITION_UNAVAILABLE
                setError('Không thể xác định vị trí. Vui lòng kiểm tra kết nối mạng và GPS.');
            } else {
                setError('Lỗi không xác định khi lấy vị trí. Vui lòng thử lại sau vài giây.');
            }
        }
    };

    // Check face sample status on mount and when user logs in
    useEffect(() => {
        if (isLoggedIn && currentUser) {
            checkFaceSampleStatus();
        }
    }, [isLoggedIn, currentUser]);

    // Cập nhật khung giờ điểm danh hiện tại mỗi phút
    useEffect(() => {
        if (!session) return;

        // Cập nhật khung giờ điểm danh ngay lập tức
        const updateAttendanceWindow = () => {
            const attendanceStatus = checkAttendanceWindow(session);
            setCurrentAttendanceWindow(attendanceStatus);
        };

        // Cập nhật ngay lần đầu
        updateAttendanceWindow();

        // Cập nhật mỗi phút
        const intervalId = setInterval(updateAttendanceWindow, 60000);

        return () => clearInterval(intervalId);
    }, [session]);

    // Function to fetch session data
    // Fetch face verification settings
    const fetchFaceVerificationSettings = async () => {
        try {
            const response = await api.get('/face-recognition-settings/thresholds');
            if (response.data.success) {
                const enabled = response.data.data.enableFaceVerification;
                setFaceVerificationEnabled(enabled);
                faceVerificationEnabledRef.current = enabled;
            }
        } catch (error) {
            console.error('Error fetching face verification settings:', error);
            // Default to enabled if error
            setFaceVerificationEnabled(true);
            faceVerificationEnabledRef.current = true;
        }
    };

    const fetchSessionData = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            // Create an API instance without auth headers for public access
            // Use getApiBaseURL() to ensure correct port in production (8043)
            const publicApi = axios.create({
                baseURL: getApiBaseURL(),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Get session details (public endpoint)
            const response = await publicApi.get(`/sessions/${id}/public`);

            if (!response.data.success) {
                throw new Error(response.data.message || t('attendanceSession.errors.cannotLoad'));
            }

            // Tính toán trạng thái chính xác dựa trên ngày và thời gian
            const sessionData = response.data.data;
            const calculatedStatus = calculateSessionStatus(sessionData);

            // Parse monitoring_options if it's a string
            let parsedSessionData = { ...sessionData };
            if (typeof sessionData.monitoring_options === 'string') {
                try {
                    parsedSessionData.monitoring_options = JSON.parse(sessionData.monitoring_options);
                } catch (error) {
                    console.error('Error parsing monitoring_options:', error);
                    parsedSessionData.monitoring_options = null;
                }
            }

            // Cập nhật session với trạng thái đã tính toán
            setSession({
                ...parsedSessionData,
                calculatedStatus: calculatedStatus
            });

            // Instead of checking if session is active, check if attendance is allowed based on windows
            const attendanceStatus = checkAttendanceWindow(parsedSessionData);
            if (!attendanceStatus.allowed) {
                setError(attendanceStatus.message);
            } else {
                // Clear error if attendance is now allowed (might have changed since last check)
                setError('');
            }

            // Update the attendance window state
            setCurrentAttendanceWindow(attendanceStatus);

            // If no token in URL and user is logged in, try to generate one
            if (!tokenFromURL && isLoggedIn) {
                try {
                    const tokenResponse = await api.post(`/sessions/${id}/generate-token`);

                    if (tokenResponse.data.success && tokenResponse.data.token) {
                        const newToken = tokenResponse.data.token;
                        setToken(newToken);

                        // Update URL with token
                        const newUrl = `${window.location.pathname}?token=${newToken}`;
                        window.history.replaceState({}, '', newUrl);
                    }
                } catch (tokenError) {
                    console.error('Error generating temporary token:', tokenError);
                    // Continue without token - will show error in UI
                }
            }

            // Request location permission with high accuracy (only on initial load, not during refresh)
            // Skip location check if VPN/Proxy is detected
            if (!isRefresh && navigator.geolocation && (!vpnStatus || (!vpnStatus.isVPN && !vpnStatus.isProxy))) {
                // Check if location is required for this session
                const locationRequired = parsedSessionData.monitoring_options?.location?.required;
                const geofenceEnabled = parsedSessionData.monitoring_options?.location?.geofence?.enabled;
                
                if (locationRequired || geofenceEnabled) {
                    setIsGettingLocation(true);
                    setError(''); // Clear any previous errors
                    
                    // First, do a quick permission check
                    try {
                        const permissionStatus = await checkLocationPermissionStatus();
                        
                        if (!permissionStatus.supported) {
                            setError(t('attendanceSession.location.notSupported'));
                            setIsGettingLocation(false);
                            return;
                        }
                        
                        if (permissionStatus.permission === 'denied') {
                            setError(t('attendanceSession.location.permissionDenied'));
                            setLocationPermissionDenied(true);
                            setIsGettingLocation(false);
                            return;
                        }
                        
                        if (permissionStatus.permission === 'unavailable') {
                            setError('Định vị GPS không khả dụng. Vui lòng kiểm tra cài đặt định vị trên thiết bị.');
                            setIsGettingLocation(false);
                            return;
                        }
                        
                    } catch (permissionError) {
                        console.error('Error checking location permission:', permissionError);
                        setError('Không thể kiểm tra quyền truy cập vị trí. Vui lòng thử lại.');
                        setIsGettingLocation(false);
                        return;
                    }
                    
                    // Add timeout to prevent infinite loading
                    const locationTimeout = setTimeout(() => {
                        setIsGettingLocation(false);
                        setHasLocationPermission(false);
                        
                        if (locationRequired && parsedSessionData.monitoring_options?.location?.enforcement === 'immediate') {
                            setError('Không thể xác định vị trí trong thời gian cho phép. Vui lòng kiểm tra quyền truy cập vị trí và thử lại.');
                        } else {
                            // If location is not immediately required, just show warning
                            setError('Không thể xác định vị trí. Một số tính năng có thể bị hạn chế.');
                        }
                    }, 30000); // Increased to 30 second timeout to accommodate retry mechanism
                    
                    getLocationWithFallback()
                        .then((position) => {
                            clearTimeout(locationTimeout);
                            const currentLocation = {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude
                            };
                            
                            setLocationData(currentLocation);
                            setHasLocationPermission(true);
                            setLocationPermissionDenied(false);
                            setIsGettingLocation(false);
                            setError(''); // Clear any location errors

                            // Check geofence immediately if available
                            if (geofenceEnabled) {
                                const geofence = parsedSessionData.monitoring_options.location.geofence;
                                const withinGeofence = isWithinGeofence(currentLocation, geofence);
                                
                                if (!withinGeofence) {
                                    if (parsedSessionData.monitoring_options?.location?.enforcement === 'immediate') {
                                        setError(t('attendanceSession.location.outsideRange', { radius: geofence.radius }));
                                    }
                                }
                            }
                        })
                        .catch((error) => {
                            clearTimeout(locationTimeout);
                            console.error('Error getting location after permission check:', error);
                            setHasLocationPermission(false);
                            setIsGettingLocation(false);

                            // Check if permission was denied permanently
                            if (error.code === 1) { // PERMISSION_DENIED
                                setLocationPermissionDenied(true);
                                setError(t('attendanceSession.location.permissionDenied'));
                            } else if (error.code === 3) { // TIMEOUT
                                setError('Không thể xác định vị trí sau nhiều lần thử. Vui lòng kiểm tra cài đặt GPS và thử lại.');
                            } else if (error.code === 2) { // POSITION_UNAVAILABLE
                                setError('Không thể xác định vị trí. Vui lòng kiểm tra tín hiệu GPS và thử lại.');
                            } else {
                                setError('Lỗi không xác định khi lấy vị trí. Vui lòng thử lại sau vài giây.');
                            }

                            // Check if location is required and enforcement is immediate
                            if (locationRequired && parsedSessionData.monitoring_options?.location?.enforcement === 'immediate') {
                                // Error already set above
                            }
                        });
                } else {
                    // Location not required, set as available
                    setHasLocationPermission(true);
                    setIsGettingLocation(false);
                }
            } else if (!isRefresh && vpnStatus && (vpnStatus.isVPN || vpnStatus.isProxy)) {
                // VPN/Proxy detected, skip location check
                setIsGettingLocation(false);
                setHasLocationPermission(false);
            } else if (isRefresh && navigator.geolocation && (!vpnStatus || (!vpnStatus.isVPN && !vpnStatus.isProxy))) {
                // During refresh, just update location without showing errors (only if no VPN/Proxy)
                getLocationWithFallback()
                    .then((position) => {
                        setLocationData({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        });
                        setHasLocationPermission(true);
                        setLocationPermissionDenied(false); // Reset permission denied state
                    })
                    .catch((error) => {
                        console.error('Error getting location during refresh:', error);
                        // Check if permission was denied permanently during refresh
                        if (error.code === 1) { // PERMISSION_DENIED
                            setLocationPermissionDenied(true);
                        }
                        // Silent error handling during refresh - don't show errors
                    });
            } else if (!navigator.geolocation) {
                // Browser doesn't support geolocation
                setHasLocationPermission(false);
                setIsGettingLocation(false);
                if (parsedSessionData.monitoring_options?.location?.required) {
                    setError(t('attendanceSession.location.notSupported'));
                }
            }

            // Check VPN status after session data is loaded
            if (!isRefresh) {
                await checkVPNStatusForAttendance();
            }

            // Data refresh complete

        } catch (error) {
            console.error('Error fetching session data:', error);
            if (!isRefresh) {
                // Only show errors during initial load, not during background refresh
                setError(error.response?.data?.message || t('attendanceSession.errors.cannotLoad'));
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Initial data fetch
    useEffect(() => {
        fetchSessionData();
        if (isLoggedIn) {
            fetchFaceVerificationSettings();
        }
    }, [id, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

    // Smart polling for session data updates (only when tab is visible and data has changed)
    // Similar to Navbar.js - updates silently in background without user notification
    useEffect(() => {
        if (!id) return;

        let pollInterval = null;
        let isPollingActive = true;
        let lastSessionDataHash = null;
        let initialTimeout = null;

        // Helper to create a hash of session data for comparison
        const getSessionDataHash = (sessionData) => {
            if (!sessionData) return null;
            try {
                // Parse monitoring_options if needed for hash comparison
                let monitoringOptions = sessionData.monitoring_options;
                if (typeof monitoringOptions === 'string') {
                    try {
                        monitoringOptions = JSON.parse(monitoringOptions);
                    } catch (e) {
                        monitoringOptions = null;
                    }
                }
                
                // Create a hash based on key fields that might change
                const keyData = {
                    status: sessionData.status,
                    monitoring_options: monitoringOptions,
                    updated_at: sessionData.updated_at,
                    password: sessionData.password,
                    password_expires_at: sessionData.password_expires_at,
                    // Include duty_students in hash to detect changes when students register
                    duty_students: monitoringOptions?.attendance?.during_session?.duty_students || null
                };
                return JSON.stringify(keyData);
            } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('Error creating session hash:', error);
                }
                return null;
            }
        };

        const checkForUpdates = async () => {
            // Only poll when tab is visible and component is still mounted
            if (document.hidden || !isPollingActive || !id) return;

            try {
                // Create an API instance without auth headers for public access
                const publicApi = axios.create({
                    baseURL: getApiBaseURL(),
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000 // 10 second timeout to prevent hanging
                });

                // Get session details silently
                const response = await publicApi.get(`/sessions/${id}/public`);

                if (!response?.data?.success || !response.data.data) return;

                const sessionData = response.data.data;
                
                // Parse monitoring_options if it's a string
                let parsedSessionData = { ...sessionData };
                if (typeof sessionData.monitoring_options === 'string') {
                    try {
                        parsedSessionData.monitoring_options = JSON.parse(sessionData.monitoring_options);
                    } catch (error) {
                        if (process.env.NODE_ENV === 'development') {
                            console.error('Error parsing monitoring_options:', error);
                        }
                        parsedSessionData.monitoring_options = null;
                    }
                }

                // Create hash of new data
                const newDataHash = getSessionDataHash(parsedSessionData);

                // Only update if data has actually changed
                if (newDataHash && newDataHash !== lastSessionDataHash) {
                    lastSessionDataHash = newDataHash;

                    // Calculate status
                    const calculatedStatus = calculateSessionStatus(parsedSessionData);

                    // Update session silently (no loading state, no notification)
                    setSession(prevSession => {
                        if (!prevSession) return parsedSessionData;
                        return {
                            ...prevSession,
                            ...parsedSessionData,
                            calculatedStatus: calculatedStatus
                        };
                    });

                    // Update attendance window
                    const attendanceStatus = checkAttendanceWindow(parsedSessionData);
                    setCurrentAttendanceWindow(attendanceStatus);

                    // Only update error if attendance is not allowed and there's a message
                    if (!attendanceStatus.allowed && attendanceStatus.message) {
                        setError(attendanceStatus.message);
                    } else if (attendanceStatus.allowed) {
                        // Clear error if attendance is now allowed
                        setError('');
                    }
                }
            } catch (error) {
                // Silently fail - don't interrupt user experience
                // Only log in development
                if (process.env.NODE_ENV === 'development') {
                    console.debug('Background session update check failed:', error);
                }
            }
        };

        // Initialize hash with current session data if available
        if (session) {
            lastSessionDataHash = getSessionDataHash(session);
        }

        // Initial check after a short delay (2 seconds)
        initialTimeout = setTimeout(() => {
            if (isPollingActive && id) {
                checkForUpdates();
            }
        }, 2000);

        // Set up polling interval (check every 5 seconds)
        pollInterval = setInterval(() => {
            if (isPollingActive && id) {
                checkForUpdates();
            }
        }, 5000);

        // Handle tab visibility changes
        const handleVisibilityChange = () => {
            if (!document.hidden && isPollingActive && id) {
                // Tab became visible, check immediately for updates
                checkForUpdates();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup function
        return () => {
            isPollingActive = false;
            if (initialTimeout) {
                clearTimeout(initialTimeout);
            }
            if (pollInterval) {
                clearInterval(pollInterval);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Smart polling for face verification settings updates (only when tab is visible and logged in)
    // Similar to Navbar.js - updates silently in background without user notification
    useEffect(() => {
        if (!isLoggedIn) return;

        let pollInterval = null;
        let isPollingActive = true;
        let lastFaceVerificationEnabled = faceVerificationEnabledRef.current;
        let initialTimeout = null;

        const checkForFaceVerificationUpdates = async () => {
            // Only poll when tab is visible and component is still mounted
            if (document.hidden || !isPollingActive || !isLoggedIn) return;

            try {
                const response = await api.get('/face-recognition-settings/thresholds', {
                    timeout: 10000 // 10 second timeout
                });

                if (response?.data?.success && response.data.data) {
                    const newFaceVerificationEnabled = response.data.data.enableFaceVerification;
                    
                    // Only update if value has actually changed
                    if (newFaceVerificationEnabled !== lastFaceVerificationEnabled) {
                        lastFaceVerificationEnabled = newFaceVerificationEnabled;
                        setFaceVerificationEnabled(newFaceVerificationEnabled);
                        // Update ref immediately to avoid race condition
                        faceVerificationEnabledRef.current = newFaceVerificationEnabled;
                    }
                }
            } catch (error) {
                // Silently fail - don't interrupt user experience
                // Only log in development
                if (process.env.NODE_ENV === 'development') {
                    console.debug('Background face verification settings update check failed:', error);
                }
            }
        };

        // Initialize with current value from ref
        lastFaceVerificationEnabled = faceVerificationEnabledRef.current;

        // Initial check after a short delay (2 seconds)
        initialTimeout = setTimeout(() => {
            if (isPollingActive && isLoggedIn) {
                checkForFaceVerificationUpdates();
            }
        }, 2000);

        // Set up polling interval (check every 5 seconds)
        pollInterval = setInterval(() => {
            if (isPollingActive && isLoggedIn) {
                checkForFaceVerificationUpdates();
            }
        }, 5000);

        // Handle tab visibility changes
        const handleVisibilityChange = () => {
            if (!document.hidden && isPollingActive && isLoggedIn) {
                // Tab became visible, check immediately for updates
                checkForFaceVerificationUpdates();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup function
        return () => {
            isPollingActive = false;
            if (initialTimeout) {
                clearTimeout(initialTimeout);
            }
            if (pollInterval) {
                clearInterval(pollInterval);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isLoggedIn, api]); // eslint-disable-line react-hooks/exhaustive-deps

    // Function to calculate distance between two coordinates in meters
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    };

    // Helper function to get location with fallback options and retry mechanism
    const getLocationWithFallback = async (options = {}, retryCount = 0) => {
        const maxRetries = 2; // Reduced retries since we have better fallback
        // Increased timeouts: High accuracy GPS can take 20-30 seconds in some environments
        const baseTimeout = 20000; // 20 seconds base timeout for high accuracy
        const timeout = baseTimeout + (retryCount * 5000); // Increase timeout with each retry: 20s, 25s, 30s
        
        const defaultOptions = {
            enableHighAccuracy: true,
            timeout: timeout,
            maximumAge: retryCount > 0 ? 300000 : 60000 // Use cached location on retry (5 minutes), 1 minute on first attempt
        };

        const fallbackOptions = {
            enableHighAccuracy: false, // Giảm độ chính xác để tăng tốc độ
            timeout: 15000, // 15 seconds for fallback (faster, less accurate)
            maximumAge: retryCount > 0 ? 600000 : 300000 // 10 minutes cache on retry, 5 minutes on first attempt
        };

        try {
            // Thử với options chính xác cao trước
            return await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        // Validate position data
                        if (!position || !position.coords) {
                            reject(new Error('Invalid position data received'));
                            return;
                        }
                        
                        const { latitude, longitude, accuracy } = position.coords;
                        
                        // Check if coordinates are valid
                        if (isNaN(latitude) || isNaN(longitude) || 
                            latitude < -90 || latitude > 90 || 
                            longitude < -180 || longitude > 180) {
                            reject(new Error('Invalid coordinates received'));
                            return;
                        }
                        
                        // Check accuracy if available
                        if (accuracy && accuracy > 10000) { // More than 10km accuracy
                            console.warn('Location accuracy is low:', accuracy, 'meters');
                        }
                        
                        resolve(position);
                    },
                    (error) => {
                        // Handle timeout gracefully - it's not necessarily an error, just slow GPS
                        if (error.code === 3) { // TIMEOUT
                            console.warn(`High accuracy location timeout (attempt ${retryCount + 1}/${maxRetries + 1}) - will try fallback`);
                        } else {
                            console.warn(`High accuracy location error (attempt ${retryCount + 1}/${maxRetries + 1}):`, error.message || error);
                        }
                        reject(error);
                    },
                    { ...defaultOptions, ...options }
                );
            });
        } catch (error) {
            // If timeout or other error, immediately try fallback (don't wait)
            // Nếu thất bại, thử với fallback options ngay lập tức
            try {
                return await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            // Validate position data
                            if (!position || !position.coords) {
                                reject(new Error('Invalid position data received'));
                                return;
                            }
                            
                            const { latitude, longitude, accuracy } = position.coords;
                            
                            // Check if coordinates are valid
                            if (isNaN(latitude) || isNaN(longitude) || 
                                latitude < -90 || latitude > 90 || 
                                longitude < -180 || longitude > 180) {
                                reject(new Error('Invalid coordinates received'));
                                return;
                            }
                            
                            // Log that we used fallback (lower accuracy)
                            if (error.code === 3) {
                                console.info('Using fallback location (lower accuracy) due to high accuracy timeout');
                            }
                            
                            resolve(position);
                        },
                        (fallbackError) => {
                            // Handle fallback timeout/error
                            if (fallbackError.code === 3) {
                                console.warn(`Fallback location timeout (attempt ${retryCount + 1}/${maxRetries + 1})`);
                            } else {
                                console.warn(`Fallback location error (attempt ${retryCount + 1}/${maxRetries + 1}):`, fallbackError.message || fallbackError);
                            }
                            reject(fallbackError);
                        },
                        { ...fallbackOptions, ...options }
                    );
                });
            } catch (fallbackError) {
                // Retry with exponential backoff if we haven't exceeded max retries
                if (retryCount < maxRetries) {
                    const backoffDelay = 1000 * (retryCount + 1); // 1s, 2s backoff
                    console.info(`Retrying location after ${backoffDelay}ms delay (attempt ${retryCount + 2}/${maxRetries + 1})`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                    return getLocationWithFallback(options, retryCount + 1);
                }
                
                // All attempts failed
                console.error(`All location attempts failed after ${maxRetries + 1} tries`);
                throw fallbackError;
            }
        }
    };

    // Check if user is within geofence
    const isWithinGeofence = (userLocation, geofence) => {
        if (!userLocation || !geofence || !geofence.enabled ||
            !geofence.coordinates || !geofence.coordinates.latitude ||
            !geofence.coordinates.longitude) {
            // If geofence is not properly configured, return true (don't restrict)
            return true;
        }

        const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            geofence.coordinates.latitude,
            geofence.coordinates.longitude
        );

        // Return true if within radius
        return distance <= geofence.radius;
    };

    // Handle attendance submission
    // Start face verification camera
    const startFaceVerificationCamera = async () => {
        try {
            // Check if getUserMedia is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setFaceVerificationStep('error');
                setFaceVerificationMessage(t('attendanceSession.faceVerification.errors.browserNotSupported'));
                setSubmitting(false);
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
                errorMessage = t('attendanceSession.faceVerification.errors.permissionDenied');
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
                // Retry with default settings
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
            } else if (error.name === 'AbortError') {
                errorMessage = 'Truy cập camera bị hủy. Vui lòng thử lại.';
            } else {
                errorMessage += `Lỗi: ${error.message || error.name}. Vui lòng thử lại hoặc liên hệ hỗ trợ.`;
            }
            
            setFaceVerificationMessage(errorMessage);
            // Ensure submitting is set to false on error so user can try again
            setSubmitting(false);
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

    // Check face sample status
    const checkFaceSampleStatus = async () => {
        try {
            const response = await api.get('/profile/face-sample/status');
            if (response.data.success) {
                setHasFaceSample(response.data.data.hasFaceSample);
            } else {
                setHasFaceSample(false);
            }
        } catch (error) {
            console.error('Error checking face sample status:', error);
            setHasFaceSample(false);
        }
    };

    // Open face verification modal
    const openFaceVerificationModal = async () => {
        try {
            setShowFaceVerificationModal(true);
            setFaceVerificationStep('preview');
            setFaceVerificationProgress(0);
            setFaceVerificationMessage('');
            setFaceVerificationAttempt(0);
            setLivenessStep(1);
            setRequiredAction(null);
            setPreviousFrame(null);
            setDetectedBbox(null);
            
            // Start camera asynchronously
            await startFaceVerificationCamera();
        } catch (error) {
            console.error('Error in openFaceVerificationModal:', error);
            setFaceVerificationStep('error');
            setFaceVerificationMessage('Không thể khởi động camera. Vui lòng thử lại.');
            setSubmitting(false);
        }
    };

    // Close face verification modal
    const closeFaceVerificationModal = () => {
        stopFaceVerificationCamera();
        setShowFaceVerificationModal(false);
        setFaceVerificationStep('preview');
        setFaceVerificationProgress(0);
        setFaceVerificationMessage('');
        setFaceVerificationAttempt(0);
        setLivenessStep(1);
        setRequiredAction(null);
        setPreviousFrame(null);
        setDetectedBbox(null);
        setSubmitting(false);
    };

    // Helper function to capture frame from video
    const captureFrame = async () => {
        const video = faceVerificationVideoRef.current;
        const canvas = faceVerificationCanvasRef.current;
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

    // Capture photo from camera in background (without showing modal)
    const captureBackgroundPhoto = async () => {
        let stream = null;
        let video = null;
        let canvas = null;

        try {
            // Check if getUserMedia is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('Camera not available for background capture');
                return null;
            }

            // Create hidden video element
            video = document.createElement('video');
            video.style.position = 'fixed';
            video.style.top = '-9999px';
            video.style.left = '-9999px';
            video.style.width = '1px';
            video.style.height = '1px';
            video.setAttribute('autoplay', '');
            video.setAttribute('playsinline', '');
            document.body.appendChild(video);

            // Create hidden canvas element
            canvas = document.createElement('canvas');
            canvas.style.position = 'fixed';
            canvas.style.top = '-9999px';
            canvas.style.left = '-9999px';
            document.body.appendChild(canvas);

            // Get camera stream
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user"
                }
            });

            // Attach stream to video element
            video.srcObject = stream;

            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                video.onloadedmetadata = () => {
                    video.play().then(resolve).catch(reject);
                };
                video.onerror = reject;
            });

            // Wait a bit for video to stabilize
            await new Promise(resolve => setTimeout(resolve, 500));

            // Get video dimensions
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;

            if (videoWidth === 0 || videoHeight === 0) {
                throw new Error('Video dimensions are invalid');
            }

            // Set canvas size to match video dimensions
            canvas.width = videoWidth;
            canvas.height = videoHeight;

            // Draw video frame to canvas
            const ctx = canvas.getContext('2d');
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
        } catch (error) {
            console.error('Error capturing background photo:', error);
            return null;
        } finally {
            // Clean up: stop stream and remove elements
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (video) {
                video.srcObject = null;
                if (video.parentNode) {
                    video.parentNode.removeChild(video);
                }
            }
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        }
    };

    // Capture and verify face in modal with 4-step liveness detection
    const captureAndVerifyFace = async () => {
        if (!faceVerificationVideoRef.current || !faceVerificationCanvasRef.current) {
            setFaceVerificationMessage('Camera chưa sẵn sàng. Vui lòng đợi...');
            return;
        }

        try {
            // ============================================
            // BƯỚC 1: Liveness Detection
            // ============================================
            setLivenessStep(1);
            setFaceVerificationStep('liveness');
            setFaceVerificationProgress(10);
            setFaceVerificationMessage(t('attendanceSession.faceVerification.steps.step1'));

            const { base64Image: frame1, imageBlob: blob1 } = await captureFrame();
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for motion
            const { base64Image: frame2 } = await captureFrame();

            setFaceVerificationProgress(20);

            // Call liveness detection API
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
                
                // Add specific guidance based on failure
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

            // ============================================
            // BƯỚC 2: Action Detection (Random)
            // ============================================
            setLivenessStep(2);
            setFaceVerificationStep('action');
            setFaceVerificationProgress(40);

            // Action: mouth only
            const actionType = 'mouth';
            setRequiredAction(actionType);

            const actionText = t('attendanceSession.faceVerification.steps.step2');
            setFaceVerificationMessage(actionText);

            // Wait for user to perform action (3 seconds)
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Capture frame after action
            const { base64Image: actionFrame } = await captureFrame();
            setFaceVerificationProgress(50);

            // Check action
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

            // ============================================
            // BƯỚC 3: Face Detection (RetinaFace)
            // BƯỚC 4: Face Recognition (ArcFace)
            // ============================================
            setLivenessStep(3);
            setFaceVerificationStep('capturing');
            setFaceVerificationProgress(65);
            setFaceVerificationMessage('Bước 3-4/4: Vui lòng giữ mặt bình thường trong 3 giây...');

            // Wait 3 seconds for face to return to normal before final capture
            await new Promise(resolve => setTimeout(resolve, 3000));

            setFaceVerificationProgress(75);
            setFaceVerificationMessage('Bước 3-4/4: Đang phát hiện và nhận diện khuôn mặt...');

            // Final capture for face recognition
            const { base64Image: finalImage, imageBlob: finalBlob } = await captureFrame();
            setFaceVerificationProgress(85);

            // Continue with attendance submission (includes face detection and recognition)
            await submitAttendanceWithFace(finalImage, finalBlob);
        } catch (error) {
            console.error('Error in liveness detection:', error);
            setFaceVerificationStep('error');
            if (error.response?.data?.message) {
                setFaceVerificationMessage(error.response.data.message);
            } else {
                setFaceVerificationMessage('Có lỗi xảy ra trong quá trình xác thực. Vui lòng thử lại.');
            }
        }
    };

    // Submit attendance with face verification
    const submitAttendanceWithFace = async (faceImageBase64, profileImage) => {
        try {
            setFaceVerificationProgress(85);
            
            // Upload profile image for monitoring (non-blocking with retry mechanism)
            // This is done asynchronously to not delay attendance submission, but ensures image is sent
            if (profileImage) {
                // Upload with retry mechanism to ensure image is sent
                const uploadProfileImageWithRetry = async (imageBlob, maxRetries = 3, retryDelay = 2000) => {
                    let lastError = null;
                    
                    for (let attempt = 1; attempt <= maxRetries; attempt++) {
                        try {
                            const formData = new FormData();
                            formData.append('file', imageBlob, 'profile.jpg');
                            formData.append('sessionId', id);
                            formData.append('dataType', 'webcam');
                            
                            await api.post('/monitoring/data?attendance=true', formData, {
                                headers: {
                                    'Content-Type': 'multipart/form-data'
                                },
                                timeout: 15000 // 15 second timeout for upload
                            });
                            
                            // Success - image uploaded
                            console.log(`Profile image uploaded successfully (attempt ${attempt}/${maxRetries})`);
                            return true;
                        } catch (uploadError) {
                            lastError = uploadError;
                            console.warn(`Profile image upload attempt ${attempt}/${maxRetries} failed:`, uploadError);
                            
                            // If not the last attempt, wait before retrying
                            if (attempt < maxRetries) {
                                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                            }
                        }
                    }
                    
                    // All retries failed - log error but don't block attendance
                    console.error('Profile image upload failed after all retries:', lastError);
                    return false;
                };
                
                // Start upload asynchronously (non-blocking)
                uploadProfileImageWithRetry(profileImage).catch(err => {
                    console.error('Unexpected error in profile image upload retry mechanism:', err);
                });
            }

            // Get device fingerprint
            let deviceMac = null;
            try {
                const { getDeviceFingerprint } = await import('../../utils/deviceFingerprint');
                deviceMac = await getDeviceFingerprint();
            } catch (fingerprintError) {
                console.error('Error getting device fingerprint:', fingerprintError);
            }

            const attendanceStatus = currentAttendanceWindow || checkAttendanceWindow(session);
            const attendanceData = {
                token,
                password,
                location: locationData,
                attendance_type: attendanceStatus.type,
                minutes_early: attendanceStatus.minutesEarly,
                minutes_late: attendanceStatus.minutesLate,
                deviceMac,
                faceImage: faceImageBase64,
                // Add duty student flag if student checked the box (for any attendance type)
                isDutyStudent: isDutyStudent ? true : undefined
            };

            setFaceVerificationProgress(90);
            setFaceVerificationMessage('Đang gửi yêu cầu điểm danh...');

            // Face verification retry mechanism
            const MAX_FACE_VERIFICATION_RETRIES = 1;
            // Removed FACE_VERIFICATION_TIMEOUT - use only API timeout to avoid conflicts
            // API timeout is 60 seconds which is sufficient for processing
            let response;
            let currentAttempt = 0;
            let verificationSuccess = false;

            while (currentAttempt <= MAX_FACE_VERIFICATION_RETRIES && !verificationSuccess) {
                try {
                    setFaceVerificationAttempt(currentAttempt + 1);
                    setFaceVerificationMessage(`Đang xác minh khuôn mặt... (Lần thử ${currentAttempt + 1}/${MAX_FACE_VERIFICATION_RETRIES + 1})`);

                    // If retry, capture new face image
                    if (currentAttempt > 0) {
                        setFaceVerificationStep('capturing');
                        setFaceVerificationProgress(50);
                        
                        const video = faceVerificationVideoRef.current;
                        const canvas = faceVerificationCanvasRef.current;
                        const ctx = canvas.getContext('2d');
                        
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        ctx.drawImage(video, 0, 0);
                        
                        const imageBlob = await new Promise((resolve, reject) => {
                            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không thể tạo ảnh')), 'image/jpeg', 0.8);
                        });
                        
                        const reader = new FileReader();
                        faceImageBase64 = await new Promise((resolve, reject) => {
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(imageBlob);
                        });
                        
                        attendanceData.faceImage = faceImageBase64;
                        setFaceVerificationProgress(80);
                        setFaceVerificationStep('verifying');
                        
                        // Wait 3 seconds before retry (reduced from 5 seconds)
                        for (let i = 3; i > 0; i--) {
                            setFaceVerificationMessage(`Khuôn mặt không khớp. Thử lại sau ${i} giây...`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }

                    // Use only API timeout (60 seconds) - removed Promise.race with 5 second timeout
                    // This prevents premature timeout when server is still processing
                    response = await api.post(`/sessions/${id}/attend`, attendanceData, { timeout: 60000 });

                    verificationSuccess = true;
                    break;

                } catch (error) {
                    if (error.response?.data?.faceVerificationFailed) {
                        currentAttempt++;
                        
                        if (currentAttempt > MAX_FACE_VERIFICATION_RETRIES) {
                            setFaceVerificationStep('error');
                            setFaceVerificationMessage('Khuôn mặt không khớp sau 2 lần thử. Điểm danh bị từ chối.');
                            setSubmitting(false);
                            return;
                        }
                        
                        setFaceVerificationStep('retry');
                        continue;
                    } else {
                        throw error;
                    }
                }
            }

            if (response?.data?.success) {
                setFaceVerificationProgress(100);
                setFaceVerificationStep('success');
                setFaceVerificationMessage('Điểm danh thành công!');
                setSuccess(response.data.message || 'Điểm danh thành công!');
                showAlert(response.data.message || 'Điểm danh thành công!', 'success');
                
                trackAttendance(id, 'normal');

                // Ensure profile image is uploaded after attendance success
                // This is a fallback in case the initial upload is still in progress
                if (profileImage) {
                    // Wait a bit for initial upload to complete, then verify/retry if needed
                    setTimeout(async () => {
                        try {
                            // Try to verify if image was uploaded by checking if we can upload again
                            // (Backend will handle duplicate gracefully)
                            const formData = new FormData();
                            formData.append('file', profileImage, 'profile.jpg');
                            formData.append('sessionId', id);
                            formData.append('dataType', 'webcam');
                            
                            await api.post('/monitoring/data?attendance=true', formData, {
                                headers: {
                                    'Content-Type': 'multipart/form-data'
                                },
                                timeout: 10000
                            });
                            console.log('Profile image verified/uploaded after attendance success');
                        } catch (verifyError) {
                            // If verification fails, it's likely already uploaded or will be retried
                            console.log('Profile image verification (non-critical):', verifyError);
                        }
                    }, 3000); // Wait 3 seconds after attendance success
                }

                // Initialize monitoring data (non-blocking - don't wait for it)
                // These are done asynchronously to not delay user feedback
                (async () => {
                    try {
                        const monitoringOptions = session.monitoring_options || {};
                        if (locationData && monitoringOptions.location?.enabled) {
                            // Get battery level asynchronously (non-blocking)
                            let batteryLevel = null;
                            try {
                                if (navigator.getBattery) {
                                    const battery = await navigator.getBattery();
                                    batteryLevel = battery.level * 100;
                                }
                            } catch (batteryError) {
                                // Ignore battery errors
                            }

                            api.post('/monitoring/data/text?attendance=true', {
                                sessionId: id,
                                dataType: 'location',
                                content: JSON.stringify({
                                    location: `${locationData.latitude}, ${locationData.longitude}`,
                                    batteryLevel: batteryLevel,
                                    networkStatus: navigator.connection ? navigator.connection.effectiveType : 'unknown'
                                })
                            }, { timeout: 5000 }).catch(err => console.error('Error posting location data:', err));
                        }

                        api.post('/monitoring/data/text?attendance=true', {
                            sessionId: id,
                            dataType: 'activity',
                            content: JSON.stringify({
                                type: 'attendance',
                                status: 'active',
                                device: navigator.userAgent
                            })
                        }, { timeout: 5000 }).catch(err => console.error('Error posting activity data:', err));
                    } catch (monitoringError) {
                        console.error('Error initializing monitoring data:', monitoringError);
                    }
                })();

                // If student registered as duty student, reload session data to show updated badge
                if (isDutyStudent) {
                    // Wait 500ms to ensure backend has updated the session
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Reload session data to show the newly enabled "Trong buổi học" badge
                    try {
                        const sessionResponse = await api.get(`/sessions/${id}`);
                        if (sessionResponse.data?.success && sessionResponse.data?.data) {
                            const sessionData = sessionResponse.data.data;
                            // Parse monitoring_options if it's a string
                            if (typeof sessionData.monitoring_options === 'string') {
                                try {
                                    sessionData.monitoring_options = JSON.parse(sessionData.monitoring_options);
                                } catch (parseError) {
                                    console.error('Error parsing monitoring_options:', parseError);
                                }
                            }
                            setSession(sessionData);
                        }
                    } catch (reloadError) {
                        console.error('Error reloading session data:', reloadError);
                    }
                }

                setTimeout(() => {
                    closeFaceVerificationModal();
                    // Add timestamp to force reload in MonitoringPage
                    navigate(`/session/${id}/monitor?reload=${Date.now()}`);
                }, 2000);
            }
        } catch (error) {
            console.error('Error submitting attendance:', error);
            setFaceVerificationStep('error');
            
            if (error.response?.data?.faceVerificationFailed) {
                setFaceVerificationMessage('Khuôn mặt không khớp với mẫu đã đăng ký.');
            } else if (error.response?.data?.message) {
                setFaceVerificationMessage(error.response.data.message);
            } else {
                setFaceVerificationMessage('Có lỗi xảy ra khi điểm danh. Vui lòng thử lại.');
            }
            setSubmitting(false);
        }
    };

    const handleSubmitAttendance = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            setSubmitting(true);

            // Check VPN status before allowing attendance
            if (vpnStatus && (vpnStatus.isVPN || vpnStatus.isProxy)) {
                setError(vpnStatus.message);
                showAlert(t('attendanceSession.vpnDetection.mustDisable'), 'danger');
                setSubmitting(false);
                return;
            }

            // Check if location is required but permission is denied
            if (session.monitoring_options?.location?.required &&
                session.monitoring_options?.location?.enforcement === 'immediate' &&
                !hasLocationPermission) {
                setError('Buổi học này yêu cầu quyền truy cập vị trí. Vui lòng cấp quyền và làm mới trang.');
                setSubmitting(false);
                return;
            }

            // Get fresh location data before checking geofence
            let currentLocationData = locationData;

            if (hasLocationPermission) {
                try {
                    const position = await getLocationWithFallback();

                    currentLocationData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };

                    // Update the state with the latest location data
                    setLocationData(currentLocationData);
                    setLocationPermissionDenied(false); // Reset permission denied state
                } catch (locError) {
                    console.error('Error getting updated location:', locError);
                    // Continue with existing location data
                }
            }

            // Check geofence restriction if enabled - STRICTLY ENFORCE THIS
            if (session.monitoring_options?.location?.enabled &&
                session.monitoring_options?.location?.geofence?.enabled) {

                if (!currentLocationData) {
                    setError(t('attendanceSession.location.cannotDetermine'));
                    setSubmitting(false);
                    return;
                }

                const geofence = session.monitoring_options.location.geofence;
                const isWithin = isWithinGeofence(currentLocationData, geofence);
                if (!isWithin) {
                    setError(`Bạn đang ở ngoài phạm vi cho phép (${geofence.radius}m). Vui lòng di chuyển đến địa điểm buổi học để điểm danh.`);
                    showAlert('Không thể điểm danh: Bạn đang ở ngoài phạm vi cho phép.', 'danger');
                    setSubmitting(false);
                    return;
                }

                // Double-check with a second location request to prevent spoofing
                try {
                    const secondPosition = await getLocationWithFallback();
                    const secondCheck = {
                        latitude: secondPosition.coords.latitude,
                        longitude: secondPosition.coords.longitude
                    };

                    if (!isWithinGeofence(secondCheck, geofence)) {
                        setError(t('attendanceSession.location.verificationFailed', { radius: geofence.radius }));
                        showAlert('Không thể điểm danh: Xác minh vị trí thất bại.', 'danger');
                        setSubmitting(false);
                        return;
                    }

                    // Update current location data with the most recent check
                    currentLocationData = secondCheck;
                    setLocationData(currentLocationData);
                    setLocationPermissionDenied(false); // Reset permission denied state
                } catch (locError) {
                    console.error('Error during second location check:', locError);
                    // Don't continue if we can't verify location with a second check
                    setError(t('attendanceSession.location.cannotVerify'));
                    setSubmitting(false);
                    return;
                }
            } else {
            }

            // Kiểm tra lại khung giờ điểm danh hiện tại để đảm bảo thông tin mới nhất
            
            let attendanceStatus = currentAttendanceWindow || checkAttendanceWindow(session);

            // If user selected "ra ca trực giữa giờ", allow attendance in "during session" window
            // (120 phút sau giờ bắt đầu và 120 phút trước giờ kết thúc)
            if (!attendanceStatus.allowed && isDutyStudent) {
                
                try {
                    const now = new Date();
                    const sessionDate = parseISO(session.date);
                    const currentDate = new Date();
                    currentDate.setFullYear(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
                    
                    const [startHours, startMinutes] = session.start_time.split(':').map(Number);
                    const [endHours, endMinutes] = session.end_time.split(':').map(Number);
                    
                    const sessionStartTime = new Date(currentDate);
                    sessionStartTime.setHours(startHours, startMinutes, 0, 0);
                    
                    const sessionEndTime = new Date(currentDate);
                    sessionEndTime.setHours(endHours, endMinutes, 0, 0);
                    
                    if (sessionEndTime < sessionStartTime) {
                        sessionEndTime.setDate(sessionEndTime.getDate() + 1);
                    }
                    
                    // Calculate during_session window: 120 phút sau giờ bắt đầu và 120 phút trước giờ kết thúc
                    const minutesAfterStart = 120;
                    const minutesBeforeEnd = 120;
                    
                    const duringStart = new Date(sessionStartTime);
                    duringStart.setMinutes(duringStart.getMinutes() + minutesAfterStart);
                    
                    const duringEnd = new Date(sessionEndTime);
                    duringEnd.setMinutes(duringEnd.getMinutes() - minutesBeforeEnd);
                    
                    // Check if current time is within the during_session window
                    if (now >= duringStart && now <= duringEnd) {
                        attendanceStatus = {
                            allowed: true,
                            type: 'during',
                            message: t('attendanceSession.attendanceWindow.inDuringWindow')
                        };
                    } else {
                    }
                } catch (dutyError) {
                    console.error('Error checking duty student attendance window:', dutyError);
                }
            }

            if (!attendanceStatus.allowed) {
                setError(attendanceStatus.message);
                setSubmitting(false);
                return;
            }

            // Check if face verification is enabled
            if (faceVerificationEnabled) {
                
                // Check if user is exempt or if face verification is required
                try {
                    const statusResponse = await api.get('/face-recognition-settings/attendance-status');
                    
                    if (statusResponse.data.success) {
                        const { required, exempt, hasFaceSample } = statusResponse.data.data;
                        
                        
                        // If user is exempt, skip face verification
                        if (exempt || !required) {
                            // Continue with attendance submission without face verification
                            // The photo will be captured in background
                            let capturedPhoto = null;
                            try {
                                capturedPhoto = await captureBackgroundPhoto();
                                if (capturedPhoto) {
                                }
                            } catch (photoError) {
                                console.warn('Failed to capture background photo:', photoError);
                            }
                            
                            // Submit attendance without face verification (same logic as else block)
                            // Get device fingerprint
                            let deviceMac = null;
                            try {
                                const { getDeviceFingerprint } = await import('../../utils/deviceFingerprint');
                                deviceMac = await getDeviceFingerprint();
                            } catch (fingerprintError) {
                                console.error('Error getting device fingerprint:', fingerprintError);
                            }

                            // Prepare attendance data
                            const attendanceData = {
                                token,
                                password,
                                location: currentLocationData,
                                attendance_type: attendanceStatus.type,
                                minutes_early: attendanceStatus.minutesEarly,
                                minutes_late: attendanceStatus.minutesLate,
                                deviceMac,
                                isDutyStudent: isDutyStudent ? true : undefined
                            };

                            // Submit attendance without face verification
                            const response = await api.post(`/sessions/${id}/attend`, attendanceData, { timeout: 60000 });
                            
                            if (response.data.success) {
                                setSuccess(response.data.message || 'Điểm danh thành công!');
                                showAlert(response.data.message || 'Điểm danh thành công!');
                                
                                // Upload profile image to monitoring data AFTER attendance is created successfully
                                if (capturedPhoto && capturedPhoto.imageBlob) {
                                    try {
                                        const formData = new FormData();
                                        formData.append('file', capturedPhoto.imageBlob, 'profile.jpg');
                                        formData.append('sessionId', id);
                                        formData.append('dataType', 'webcam');

                                        await api.post('/monitoring/data?attendance=true', formData, {
                                            headers: {
                                                'Content-Type': 'multipart/form-data'
                                            }
                                        });
                                    } catch (uploadError) {
                                        console.error('Error uploading profile image:', uploadError);
                                    }
                                }

                                // Initialize monitoring data
                                try {
                                    const monitoringOptions = session.monitoring_options || {};
                                    if (currentLocationData && monitoringOptions.location?.enabled) {
                                        await api.post('/monitoring/data/text?attendance=true', {
                                            sessionId: id,
                                            dataType: 'location',
                                            content: JSON.stringify({
                                                location: `${currentLocationData.latitude}, ${currentLocationData.longitude}`,
                                                batteryLevel: navigator.getBattery ? (await navigator.getBattery()).level * 100 : null,
                                                networkStatus: navigator.connection ? navigator.connection.effectiveType : 'unknown'
                                            })
                                        });
                                    }

                                    await api.post('/monitoring/data/text?attendance=true', {
                                        sessionId: id,
                                        dataType: 'activity',
                                        content: JSON.stringify({
                                            type: 'attendance',
                                            status: 'active',
                                            device: navigator.userAgent
                                        })
                                    });
                                } catch (monitoringError) {
                                    console.error('Error initializing monitoring data:', monitoringError);
                                }
                                
                                // Refresh session data
                                await fetchSessionData(true);
                                
                                if (isDutyStudent) {
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                    await fetchSessionData(true);
                                }
                                
                                // Redirect to monitor page after 2 seconds
                                setTimeout(() => {
                                    navigate(`/session/${id}/monitor?reload=${Date.now()}`);
                                }, 2000);
                            } else {
                                setError(response.data.message || 'Không thể điểm danh');
                                showAlert(response.data.message || 'Không thể điểm danh', 'danger');
                            }
                            setSubmitting(false);
                            return;
                        }
                        
                        // Face verification is required - check face sample
                        if (hasFaceSample === false || hasFaceSample === null) {
                            // Check face sample status before opening modal
                            if (hasFaceSample === null) {
                                await checkFaceSampleStatus();
                            }
                            
                            if (hasFaceSample === false) {
                                // User doesn't have face sample - show modal with instruction
                                setShowFaceSampleRequiredModal(true);
                                setSubmitting(false);
                                return;
                            }
                        }
                        
                        // User has face sample and verification is required - open face verification modal
                        try {
                            openFaceVerificationModal();
                        } catch (error) {
                            console.error('Error opening face verification modal:', error);
                            setError('Không thể mở cửa sổ xác minh khuôn mặt. Vui lòng thử lại.');
                            setSubmitting(false);
                        }
                        return;
                    }
                } catch (statusError) {
                    console.error('Error checking face verification status:', statusError);
                    // Fallback to old behavior if status check fails
                    
                    // Check face sample status before opening modal
                    if (hasFaceSample === null) {
                        await checkFaceSampleStatus();
                    }

                    if (hasFaceSample === false) {
                        // User doesn't have face sample - show modal with instruction
                        setShowFaceSampleRequiredModal(true);
                        setSubmitting(false);
                        return;
                    }

                    // User has face sample - open face verification modal
                    try {
                        openFaceVerificationModal();
                    } catch (error) {
                        console.error('Error opening face verification modal:', error);
                        setError('Không thể mở cửa sổ xác minh khuôn mặt. Vui lòng thử lại.');
                        setSubmitting(false);
                    }
                    return;
                }
            } else {
                // Face verification is disabled - capture photo in background and submit attendance
                
                // Capture photo in background (without showing modal)
                let capturedPhoto = null;
                try {
                    capturedPhoto = await captureBackgroundPhoto();
                    if (capturedPhoto) {
                    } else {
                        console.warn('Failed to capture background photo, continuing without photo');
                    }
                } catch (photoError) {
                    console.error('Error capturing background photo:', photoError);
                    // Continue without photo if capture fails
                }

                // Get device fingerprint
                let deviceMac = null;
                try {
                    const { getDeviceFingerprint } = await import('../../utils/deviceFingerprint');
                    deviceMac = await getDeviceFingerprint();
                } catch (fingerprintError) {
                    console.error('Error getting device fingerprint:', fingerprintError);
                }

                // Prepare attendance data
                const attendanceData = {
                    token,
                    password,
                    location: currentLocationData,
                    attendance_type: attendanceStatus.type,
                    minutes_early: attendanceStatus.minutesEarly,
                    minutes_late: attendanceStatus.minutesLate,
                    deviceMac,
                    // Add duty student flag if student checked the box (for any attendance type)
                    isDutyStudent: isDutyStudent ? true : undefined
                };

                // Submit attendance without face verification
                // Tăng timeout lên 60 giây để xử lý khi có nhiều request đồng thời
                const response = await api.post(`/sessions/${id}/attend`, attendanceData, { timeout: 60000 });
                
                if (response.data.success) {
                    setSuccess(response.data.message || 'Điểm danh thành công!');
                    showAlert(response.data.message || 'Điểm danh thành công!');
                    
                    // Upload profile image to monitoring data AFTER attendance is created successfully
                    if (capturedPhoto && capturedPhoto.imageBlob) {
                        try {
                            const formData = new FormData();
                            formData.append('file', capturedPhoto.imageBlob, 'profile.jpg');
                            formData.append('sessionId', id);
                            formData.append('dataType', 'webcam');

                            await api.post('/monitoring/data?attendance=true', formData, {
                                headers: {
                                    'Content-Type': 'multipart/form-data'
                                }
                            });
                        } catch (uploadError) {
                            console.error('Error uploading profile image:', uploadError);
                            // Continue even if upload fails
                        }
                    }

                    // Initialize monitoring data (location and activity)
                    try {
                        const monitoringOptions = session.monitoring_options || {};
                        if (currentLocationData && monitoringOptions.location?.enabled) {
                            await api.post('/monitoring/data/text?attendance=true', {
                                sessionId: id,
                                dataType: 'location',
                                content: JSON.stringify({
                                    location: `${currentLocationData.latitude}, ${currentLocationData.longitude}`,
                                    batteryLevel: navigator.getBattery ? (await navigator.getBattery()).level * 100 : null,
                                    networkStatus: navigator.connection ? navigator.connection.effectiveType : 'unknown'
                                })
                            });
                        }

                        await api.post('/monitoring/data/text?attendance=true', {
                            sessionId: id,
                            dataType: 'activity',
                            content: JSON.stringify({
                                type: 'attendance',
                                status: 'active',
                                device: navigator.userAgent
                            })
                        });
                    } catch (monitoringError) {
                        console.error('Error initializing monitoring data:', monitoringError);
                    }
                    
                    // Refresh session data
                    await fetchSessionData(true);
                    
                    // If student registered as duty student, wait a bit for backend to update and reload again
                    if (isDutyStudent) {
                        // Wait 500ms to ensure backend has updated the session
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Reload session data again to show the newly enabled "Trong buổi học" badge
                        await fetchSessionData(true);
                    }
                    
                    // Redirect to monitor page after 2 seconds
                    setTimeout(() => {
                        // Add timestamp to force reload in MonitoringPage
                        navigate(`/session/${id}/monitor?reload=${Date.now()}`);
                    }, 2000);
                } else {
                    setError(response.data.message || 'Không thể điểm danh');
                    showAlert(response.data.message || 'Không thể điểm danh', 'danger');
                }
                setSubmitting(false);
                return;
            }
        } catch (error) {
            console.error('=== ERROR in handleSubmitAttendance ===');
            console.error('Error object:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Error response:', error.response);
            console.error('Error config:', error.config);

            // Track attendance error
            trackError('attendance_error', error.response?.data?.message || error.message);

            // Log the complete error response for debugging
            // Show detailed error message from server if available
            let errorMessage = t('attendanceSession.errors.generic');

            if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
                errorMessage = t('attendanceSession.errors.systemSlow');
                showAlert('Hệ thống đang xử lý chậm. Vui lòng đợi một lát và thử lại.', 'warning');
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;

                // Nếu là thông báo đã điểm danh trước đó và có trạng thái duplicate
                if (error.response?.data?.duplicate) {
                    setError(errorMessage);
                    showAlert(errorMessage, 'warning');
                    setSubmitting(false);
                    return; // Tránh chuyển hướng và hiển thị thành công
                }

                // Face verification errors should already be handled in retry loop above
                // These are fallback handlers for edge cases
                if (error.response?.data?.faceVerificationFailed) {
                    errorMessage = error.response.data.message || 'Khuôn mặt không khớp với mẫu đã đăng ký.';
                    showAlert(errorMessage, 'warning');
                    setSubmitting(false);
                    return;
                }

                if (error.response?.data?.faceVerificationRequired) {
                    errorMessage = error.response.data.message || 'Bạn đã đăng ký nhận diện khuôn mặt. Vui lòng chụp ảnh khuôn mặt để điểm danh.';
                    showAlert(errorMessage, 'warning');
                    setSubmitting(false);
                    return;
                }

                if (error.response?.data?.faceVerificationError) {
                    errorMessage = error.response.data.message || 'Không thể xác minh khuôn mặt. Vui lòng thử lại.';
                    showAlert(errorMessage, 'danger');
                    setSubmitting(false);
                    return;
                }
            } else if (error.response?.status === 400) {
                errorMessage = t('attendanceSession.errors.invalidData');
            } else if (error.response?.status === 401) {
                errorMessage = t('attendanceSession.errors.unauthorized');
            } else if (error.response?.status === 404) {
                errorMessage = t('attendanceSession.errors.notFound');
            } else if (error.response?.status === 500) {
                errorMessage = 'Lỗi máy chủ. Vui lòng thử lại sau.';
            }

            setError(errorMessage);

            // Log additional details for debugging
            if (error.response?.data?.errors) {
                console.error('Validation errors:', error.response.data.errors);
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Handle login redirect
    const handleLogin = () => {
        // Store the current URL in localStorage to redirect back after login
        localStorage.setItem('redirectUrl', window.location.pathname + window.location.search);
        navigate('/login');
    };

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
                <div className="text-center">
                    <div className="mb-3">
                        <Loader2 size={40} className="animate-spin text-primary" />
                    </div>
                    <p className="mt-3 text-gray-600">{t('attendanceSession.loading')}</p>
                </div>
            </Container>
        );
    }

    if (!session) {
        return (
            <Container className="mt-5">
                <div className="modern-card">
                    <div className="p-5 text-center">
                        <div className="rounded-circle bg-danger bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-4" style={{ width: '80px', height: '80px' }}>
                            <i className="fas fa-exclamation-triangle text-danger fa-2x"></i>
                        </div>
                        <h4 className="mb-3">{t('attendanceSession.sessionNotFound')}</h4>
                        <p className="text-gray-600 mb-4">{error || t('attendanceSession.sessionNotFoundDesc')}</p>
                        <Button
                            className="modern-btn modern-btn-primary"
                            onClick={() => navigate('/')}
                        >
                            {t('attendanceSession.goHome')}
                        </Button>
                    </div>
                </div>
            </Container>
        );
    }

    // Always require login for attendance
    if (!isLoggedIn) {
        // Store the current URL for redirect after login
        localStorage.setItem('redirectUrl', window.location.pathname + window.location.search);

        return (
            <Container className="mt-5">
                <Row className="justify-content-center">
                    <Col md={8} lg={6}>
                        <div className="modern-card shadow">
                            <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                                <div></div>
                                {refreshing && (
                                    <div className="d-flex align-items-center">
                                        <Loader2 size={16} className="animate-spin me-1 text-primary" />
                                        <small className="text-muted">{t('attendanceSession.updating')}</small>
                                    </div>
                                )}
                            </div>
                            <div className="card-body">
                                <div className="text-center mb-4">
                                    <h3 className="mb-0 fw-bold">{session.title}</h3>
                                </div>

                                {error && (
                                    <div className="modern-alert modern-alert-danger">
                                        <div className="d-flex align-items-start">
                                            <i className="fas fa-exclamation-circle mt-1 me-2"></i>
                                            <div>{error}</div>
                                        </div>
                                    </div>
                                )}

                                <div className="text-center p-4 my-4 bg-light rounded-lg">
                                    <div className="rounded-circle bg-primary bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-4" style={{ width: '80px', height: '80px' }}>
                                        <Lock size={32} className="text-primary" />
                                    </div>
                                    <h5 className="mb-3">{t('attendanceSession.loginRequired')}</h5>
                                    <p className="text-muted mb-4">{t('attendanceSession.loginRequiredDesc')}</p>
                                    <Button
                                        className="modern-btn modern-btn-primary py-2 px-4"
                                        onClick={handleLogin}
                                        size="lg"
                                    >
                                        <i className="fas fa-sign-in-alt me-2"></i>
                                        {t('attendanceSession.loginNow')}
                                    </Button>
                                </div>
                            </div>
                            <div className="card-footer bg-white text-center">
                                <small className="text-muted">PCTU MedManage IMS System</small>
                            </div>
                        </div>
                    </Col>
                </Row>
            </Container>
        );
    }

    // For regular attendance (logged in users)
    return (
        <Container className="mt-1">
            <Row className="justify-content-center">
                <Col md={8} lg={6}>
                    <div className="modern-card shadow">
                        <div className="card-header bg-white border-0">
                            <div className="d-flex justify-content-between align-items-center">
                                <div></div>
                                {refreshing && (
                                    <div className="d-flex align-items-center">
                                        <Loader2 size={16} className="animate-spin me-1 text-primary" />
                                        <small className="text-muted">{t('attendanceSession.updating')}</small>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="card-body">
                            <div className="text-center mb-4">
                                <span className="badge bg-light text-primary px-3 py-2 mb-2">
                                    <Calendar size={16} className="me-1" />
                                    {session.end_date && session.end_date !== session.date ?
                                        `${format(parseISO(session.date), 'dd/MM/yyyy')} - ${format(parseISO(session.end_date), 'dd/MM/yyyy')}` :
                                        format(parseISO(session.date), 'dd/MM/yyyy')}
                                </span>
                                <h3 className="fw-bold mb-0 text-dark session-title-wrap">{session.title}</h3>
                                <div className="d-flex justify-content-center align-items-center gap-3 mt-2">
                                    <span className="text-muted small">
                                        <Clock size={14} className="me-1" />
                                        {session.start_time} - {session.end_time}
                                    </span>
                                </div>
                                <div className="d-flex justify-content-center align-items-center gap-3 mt-2">
                                    <span className="text-muted small">
                                        <MapPin size={14} className="me-1" />
                                        {session.location}
                                    </span>
                                </div>
                            </div>

                            {/* VPN Detection Status */}
                            {isCheckingVPN && (
                                <div className="modern-alert modern-alert-info mb-4">
                                    <div className="d-flex align-items-center">
                                        <div className="rounded-circle bg-info bg-opacity-10 p-2 me-3">
                                            <Loader2 size={20} className="text-info animate-spin" />
                                        </div>
                                        <div>
                                            <div className="fw-medium">{t('attendanceSession.vpnDetection.checking')}</div>
                                            <div className="text-muted small">{t('attendanceSession.vpnDetection.checkingDesc')}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Only show VPN detection warning when VPN/Proxy is detected */}
                            {vpnStatus && !isCheckingVPN && (vpnStatus.isVPN || vpnStatus.isProxy) && (
                                <div className={`mb-4 p-4 rounded-lg shadow-sm ${
                                    vpnStatus.severity === 'warning' ? 'bg-warning bg-opacity-10' : 
                                    vpnStatus.severity === 'error' ? 'bg-danger bg-opacity-10' : 
                                    'bg-danger bg-opacity-10'
                                }`}>
                                    <div className="d-flex align-items-center mb-3">
                                        <div className={`rounded-circle me-3 ${
                                            vpnStatus.severity === 'warning' ? 'bg-warning' : 
                                            vpnStatus.severity === 'error' ? 'bg-danger' : 
                                            'bg-danger'
                                        }`} style={{ width: '12px', height: '12px' }}></div>
                                        <span className={`fw-medium ${
                                            vpnStatus.severity === 'warning' ? 'text-warning' : 
                                            vpnStatus.severity === 'error' ? 'text-danger' : 
                                            'text-danger'
                                        }`}>
                                            {vpnStatus.isVPN ? t('attendanceSession.vpnDetection.detected') : 
                                             vpnStatus.isProxy ? t('attendanceSession.vpnDetection.detectedProxy') : 
                                             t('attendanceSession.vpnDetection.detectedBoth')}
                                        </span>
                                    </div>

                                    <div className="bg-white rounded-lg p-3">
                                        <div className="mb-3">
                                            <div className="fw-medium mb-2">{vpnStatus.message}</div>
                                            {vpnStatus.detectedService && (
                                                <div className="text-muted small">
                                                    <strong>Dịch vụ phát hiện:</strong> {vpnStatus.detectedService}
                                                </div>
                                            )}
                                            {vpnStatus.confidence > 0 && (
                                                <div className="text-muted small">
                                                    <strong>Độ tin cậy:</strong> {vpnStatus.confidence}%
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {vpnCheckError && (
                                <div className="modern-alert modern-alert-danger mb-4">
                                    <div className="d-flex align-items-start">
                                        <i className="fas fa-exclamation-circle mt-1 me-2"></i>
                                        <div>
                                            <div className="fw-medium">{t('attendanceSession.vpnDetection.error')}</div>
                                            <div className="text-muted small mt-1">{vpnCheckError}</div>
                                            <button
                                                className="btn btn-outline-primary btn-sm mt-2"
                                                onClick={checkVPNStatusForAttendance}
                                                disabled={isCheckingVPN}
                                            >
                                                <i className="fas fa-sync-alt me-1"></i>
                                                {t('attendanceSession.vpnDetection.retry')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Geofence Status Indicator */}
                            {session.monitoring_options?.location?.enabled &&
                                session.monitoring_options?.location?.geofence?.enabled &&
                                locationData && (
                                    <div className={`mb-4 p-4 rounded-lg shadow-sm ${isWithinGeofence(locationData, session.monitoring_options.location.geofence) ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'}`}>
                                        <div className="d-flex align-items-center mb-3">
                                            <div className={`rounded-circle me-3 ${isWithinGeofence(locationData, session.monitoring_options.location.geofence) ? 'bg-success' : 'bg-danger'}`} style={{ width: '12px', height: '12px' }}></div>
                                            <span className={`fw-medium ${isWithinGeofence(locationData, session.monitoring_options.location.geofence) ? 'text-success' : 'text-danger'}`}>
                                                {(() => {
                                                    // Find location name based on geofence coordinates
                                                    const geofenceCoords = session.monitoring_options.location.geofence.coordinates;
                                                    const locationMatch = findHospitalByCoordinates(
                                                        geofenceCoords.latitude,
                                                        geofenceCoords.longitude,
                                                        hospitalLocations
                                                    );

                                                    const locationName = locationMatch || session.location || 'Địa điểm buổi học';

                                                    return isWithinGeofence(locationData, session.monitoring_options.location.geofence)
                                                        ? t('attendanceSession.geofence.withinArea', { location: locationName })
                                                        : t('attendanceSession.geofence.outsideArea', { location: locationName });
                                                })()}
                                            </span>
                                        </div>

                                        <div className="bg-white rounded-lg p-3">
                                            {(() => {
                                                // Find location name based on geofence coordinates
                                                const geofenceCoords = session.monitoring_options.location.geofence.coordinates;
                                                const locationMatch = findHospitalByCoordinates(
                                                    geofenceCoords.latitude,
                                                    geofenceCoords.longitude,
                                                    hospitalLocations
                                                );

                                                // Display location details
                                                return (
                                                    <div>
                                                        <div className="d-flex align-items-center mb-2">
                                                            <MapPin size={16} className="me-2 text-primary" />
                                                            <span>
                                                                <strong>{t('attendanceSession.location.label')}:</strong> {locationMatch || session.location || t('attendanceSession.location.unknown')}
                                                            </span>
                                                        </div>
                                                        <div className="d-flex align-items-center">
                                                            <i className="fas fa-circle-notch me-2 text-primary"></i>
                                                            <span>
                                                                <strong>Phạm vi cho phép:</strong> {session.monitoring_options.location.geofence.radius}m
                                                            </span>
                                                        </div>
                                                        {locationData && (
                                                            <div className="mt-3 text-center">
                                                                <button
                                                                    className="btn-modern"
                                                                    onClick={() => {
                                                                        const { latitude, longitude } = session.monitoring_options.location.geofence.coordinates;
                                                                        window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
                                                                    }}
                                                                >
                                                                    <i className="fas fa-map-marker-alt"></i> {t('attendanceSession.location.viewMap')}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}


                            {/* Hiển thị khung giờ điểm danh hiện tại */}
                            {currentAttendanceWindow && currentAttendanceWindow.allowed && (
                                <div className="modern-alert modern-alert-success mb-4">
                                    <div className="d-flex align-items-center">
                                        <div className="rounded-circle bg-success bg-opacity-10 p-2 me-3">
                                            <Clock size={20} className="text-success" />
                                        </div>
                                        <div>
                                            <div className="fw-medium">
                                                <strong>{t('attendanceSession.attendanceWindow.currentWindow')} </strong>
                                                {currentAttendanceWindow.type === 'before' && t('attendanceSession.attendanceWindow.before')}
                                                {currentAttendanceWindow.type === 'during' && t('attendanceSession.attendanceWindow.during')}
                                                {currentAttendanceWindow.type === 'after' && t('attendanceSession.attendanceWindow.after')}
                                                {currentAttendanceWindow.type === 'early' && t('attendanceSession.attendanceWindow.early')}
                                                {currentAttendanceWindow.type === 'late' && t('attendanceSession.attendanceWindow.late')}
                                                {currentAttendanceWindow.type === 'late_before' && t('attendanceSession.attendanceWindow.late')}
                                                {currentAttendanceWindow.type === 'late_leave' && t('attendanceSession.attendanceWindow.lateLeave')}
                                                {!['before', 'during', 'after', 'early', 'late_before', 'late', 'late_leave'].includes(currentAttendanceWindow.type) && t('attendanceSession.button.attendance')}
                                            </div>
                                            {currentAttendanceWindow.message && (
                                                <div className="text-muted mt-1">{currentAttendanceWindow.message}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Show attendance status information */}
                            {session.monitoring_options?.attendance && (
                                <div className="bg-light rounded-lg p-4 mb-4 shadow-sm">
                                    <div className="d-flex align-items-center mb-3">
                                        <div className="rounded-circle bg-info bg-opacity-10 p-2 me-2">
                                            <i className="fas fa-info-circle text-info"></i>
                                        </div>
                                        <h6 className="mb-0 fw-bold">{t('attendanceSession.attendanceInfo.title')}</h6>
                                    </div>

                                    <div className="timeline">
                                        {session.monitoring_options.attendance.before_session?.enabled && (
                                            <div className="timeline-item">
                                                <div className="timeline-dot timeline-dot-primary"></div>
                                                <div className="timeline-content">
                                                    <div className="d-flex align-items-center mb-2">
                                                        <div className="badge modern-badge-primary me-2">
                                                            <i className="fas fa-hourglass-start me-1"></i>
                                                            {t('attendanceSession.attendanceInfo.beforeSession')}
                                                        </div>
                                                    </div>
                                                    <div className="text-muted small">
                                                        {(() => {
                                                            // Calculate actual time window for before session attendance
                                                            const sessionDate = new Date(session.date);
                                                            const [startHours, startMinutes] = session.start_time.split(':').map(Number);

                                                            // Set session start time
                                                            const sessionStartTime = new Date(sessionDate);
                                                            sessionStartTime.setHours(startHours, startMinutes, 0, 0);

                                                            // Calculate before session start time
                                                            const beforeStart = new Date(sessionStartTime);
                                                            beforeStart.setMinutes(beforeStart.getMinutes() - session.monitoring_options.attendance.before_session.minutes_before);

                                                            // Format times
                                                            const beforeStartFormatted = `${beforeStart.getHours().toString().padStart(2, '0')}:${beforeStart.getMinutes().toString().padStart(2, '0')}`;
                                                            const sessionStartFormatted = `${sessionStartTime.getHours().toString().padStart(2, '0')}:${sessionStartTime.getMinutes().toString().padStart(2, '0')}`;

                                                            return t('attendanceSession.attendanceInfo.timeWindow', { startTime: beforeStartFormatted, endTime: sessionStartFormatted });
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {session.monitoring_options.attendance.during_session?.enabled && (
                                            <div className="timeline-item">
                                                <div className="timeline-dot timeline-dot-success"></div>
                                                <div className="timeline-content">
                                                    <div className="d-flex align-items-center mb-2">
                                                        <div className="badge modern-badge-success me-2">
                                                            <i className="fas fa-clock me-1"></i>
                                                            {t('attendanceSession.attendanceInfo.duringSession')}
                                                        </div>
                                                    </div>
                                                    <div className="text-muted small">
                                                        {(() => {
                                                            // Calculate actual time window for during session attendance
                                                            const sessionDate = new Date(session.date);
                                                            const [startHours, startMinutes] = session.start_time.split(':').map(Number);
                                                            const [endHours, endMinutes] = session.end_time.split(':').map(Number);

                                                            // Set session start and end times
                                                            const sessionStartTime = new Date(sessionDate);
                                                            sessionStartTime.setHours(startHours, startMinutes, 0, 0);

                                                            const sessionEndTime = new Date(sessionDate);
                                                            sessionEndTime.setHours(endHours, endMinutes, 0, 0);

                                                            // Handle sessions that span across midnight
                                                            if (sessionEndTime < sessionStartTime) {
                                                                sessionEndTime.setDate(sessionEndTime.getDate() + 1);
                                                            }

                                                            // Calculate during session window
                                                            const duringStart = new Date(sessionStartTime);
                                                            duringStart.setMinutes(duringStart.getMinutes() + session.monitoring_options.attendance.during_session.minutes_after_start);

                                                            const duringEnd = new Date(sessionEndTime);
                                                            duringEnd.setMinutes(duringEnd.getMinutes() - session.monitoring_options.attendance.during_session.minutes_before_end);

                                                            // Format times
                                                            const duringStartFormatted = `${duringStart.getHours().toString().padStart(2, '0')}:${duringStart.getMinutes().toString().padStart(2, '0')}`;
                                                            const duringEndFormatted = `${duringEnd.getHours().toString().padStart(2, '0')}:${duringEnd.getMinutes().toString().padStart(2, '0')}`;

                                                            return t('attendanceSession.attendanceInfo.timeWindow', { startTime: duringStartFormatted, endTime: duringEndFormatted });
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {session.monitoring_options.attendance.after_session?.enabled && (
                                            <div className="timeline-item">
                                                <div className="timeline-dot timeline-dot-info"></div>
                                                <div className="timeline-content">
                                                    <div className="d-flex align-items-center mb-2">
                                                        <div className="badge modern-badge-info me-2">
                                                            <i className="fas fa-hourglass-end me-1"></i>
                                                            {t('attendanceSession.attendanceInfo.afterSession')}
                                                        </div>
                                                    </div>
                                                    <div className="text-muted small">
                                                        {(() => {
                                                            // Calculate actual time window for after session attendance
                                                            const sessionDate = new Date(session.date);
                                                            const [endHours, endMinutes] = session.end_time.split(':').map(Number);

                                                            // Set session end time
                                                            const sessionEndTime = new Date(sessionDate);
                                                            sessionEndTime.setHours(endHours, endMinutes, 0, 0);

                                                            // Calculate after session window
                                                            const afterStart = new Date(sessionEndTime);
                                                            afterStart.setMinutes(afterStart.getMinutes() + session.monitoring_options.attendance.after_session.minutes_after);

                                                            const afterEnd = new Date(afterStart);
                                                            afterEnd.setMinutes(afterEnd.getMinutes() + session.monitoring_options.attendance.after_session.duration);

                                                            // Format times
                                                            const afterStartFormatted = `${afterStart.getHours().toString().padStart(2, '0')}:${afterStart.getMinutes().toString().padStart(2, '0')}`;
                                                            const afterEndFormatted = `${afterEnd.getHours().toString().padStart(2, '0')}:${afterEnd.getMinutes().toString().padStart(2, '0')}`;

                                                            return t('attendanceSession.attendanceInfo.timeWindow', { startTime: afterStartFormatted, endTime: afterEndFormatted });
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {success && (
                                <div className="modern-alert modern-alert-success mb-4">
                                    <div className="d-flex align-items-center">
                                        <div className="rounded-circle bg-success bg-opacity-10 p-2 me-3">
                                            <CheckCircle size={20} className="text-success" />
                                        </div>
                                        <div>{success}</div>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="modern-alert modern-alert-danger mb-4">
                                    <div className="d-flex align-items-start">
                                        <i className="fas fa-exclamation-circle mt-1 me-2"></i>
                                        <div>{error}</div>
                                    </div>
                                </div>
                            )}

              {/* Thông báo cho sinh viên ra ca trực */}
              {session.monitoring_options?.attendance?.during_session?.duty_students?.some(dutyStudent => 
                dutyStudent.id === currentUser?.id || 
                dutyStudent.student_id === currentUser?.student_id || 
                dutyStudent.student_id === currentUser?.username
              ) && (
                <div className="modern-alert modern-alert-info mb-4">
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-info bg-opacity-10 p-2 me-3">
                      <i className="fas fa-user-clock text-info"></i>
                    </div>
                    <div>
                      <strong>{t('attendanceSession.dutyStudent.badge')}</strong>
                      <br />
                      <small>
                        {currentAttendanceWindow?.type === 'after' 
                          ? t('attendanceSession.dutyStudent.messageAfter')
                          : t('attendanceSession.dutyStudent.messageDuring')
                        }
                      </small>
                    </div>
                  </div>
                </div>
              )}
                            {isLoggedIn && (
                                <Form onSubmit={handleSubmitAttendance}>


                                    {session.password && (
                                        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                                            <Form.Group controlId="password">
                                                <Form.Label className="fw-medium">{t('attendanceSession.sessionPassword')}</Form.Label>
                                                <div className="input-group">
                                                    <div className="input-group-text bg-light">
                                                        <Lock size={16} />
                                                    </div>
                                                    <Form.Control
                                                        type="password"
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        placeholder={t('attendanceSession.sessionPasswordPlaceholder')}
                                                        required
                                                        disabled={!!success}
                                                        className="modern-form-control"
                                                    />
                                                </div>
                                                <Form.Text className="text-muted">
                                                    {t('attendanceSession.sessionPasswordHelp')}
                                                </Form.Text>
                                            </Form.Group>
                                        </div>
                                    )}

                                    {/* Duty student checkbox - show when session is active and user can attend */}
                                    {canShowDutyStudentCheckbox() && (
                                        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm border border-warning">
                                            <div className="d-flex align-items-start">
                                                <div className="rounded-circle bg-warning bg-opacity-10 p-2 me-3">
                                                    <i className="fas fa-user-clock text-warning"></i>
                                                </div>
                                                <div className="flex-grow-1">
                                                    <Form.Check 
                                                        type="checkbox"
                                                        id="dutyStudentCheckbox"
                                                        checked={isDutyStudent}
                                                        onChange={(e) => setIsDutyStudent(e.target.checked)}
                                                        disabled={!!success}
                                                        label={
                                                            <div>
                                                                <strong className="text-warning">{t('attendanceSession.dutyStudent.title')}</strong>
                                                                <br />
                                                                <small className="text-muted">
                                                                    {t('attendanceSession.dutyStudent.description')}
                                                                </small>
                                                            </div>
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="d-grid gap-2 mt-4">
                                        <button
                                            type="submit"
                                            className="btn-skew-arrow"
                                            disabled={
                                                submitting ||
                                                !!success ||
                                                isGettingLocation ||
                                                isCheckingVPN ||
                                                // Disable button if VPN/Proxy is detected
                                                (vpnStatus && (vpnStatus.isVPN || vpnStatus.isProxy)) ||
                                                // Disable button if outside geofence
                                                (session.monitoring_options?.location?.enabled &&
                                                    session.monitoring_options?.location?.geofence?.enabled &&
                                                    locationData &&
                                                    !isWithinGeofence(locationData, session.monitoring_options.location.geofence)) ||
                                                    // Disable "after session" attendance for duty students
                                                    (currentAttendanceWindow?.type === 'after' && 
                                                     session.monitoring_options?.attendance?.during_session?.duty_students?.some(dutyStudent => 
                                                       dutyStudent.id === currentUser?.id || 
                                                       dutyStudent.student_id === currentUser?.student_id || 
                                                       dutyStudent.student_id === currentUser?.username
                                                     ))
                                            }
                                        >
                                            <span className="text">
                                                {submitting ? (
                                                    <div className="d-flex align-items-center justify-content-center gap-2">
                                                        <Loader2 size={20} className="animate-spin" />
                                                        <span>{t('attendanceSession.button.processing')}</span>
                                                    </div>
                                                ) : isGettingLocation ? (
                                                    <div className="d-flex align-items-center justify-content-center gap-2">
                                                        <Loader2 size={20} className="animate-spin" />
                                                        <span>{t('attendanceSession.button.gettingLocation')}</span>
                                                    </div>
                                                ) : isCheckingVPN ? (
                                                    <div className="d-flex align-items-center justify-content-center gap-2">
                                                        <Loader2 size={20} className="animate-spin" />
                                                        <span>{t('attendanceSession.button.checkingVPN')}</span>
                                                    </div>
                                                ) : (() => {
                                                    // Sử dụng state currentAttendanceWindow đã được cập nhật
                                                    if (!currentAttendanceWindow) {
                                                        return (
                                                            <div className="d-flex align-items-center justify-content-center gap-2">
                                                                {faceVerificationEnabled && (
                                                                    <i className="fas fa-user-check" style={{ fontSize: '16px' }}></i>
                                                                )}
                                                                <span>{isDutyStudent ? t('attendanceSession.dutyStudent.buttonText') : t('attendanceSession.button.attendance')}</span>
                                                            </div>
                                                        );
                                                    }

                                                    let icon = 'fas fa-check-circle';
                                                    let text = t('attendanceSession.button.attendance');

                                                    switch (currentAttendanceWindow.type) {
                                                        case 'before':
                                                            text = t('attendanceSession.attendanceWindow.before');
                                                            icon = 'fas fa-hourglass-start';
                                                            break;
                                                        case 'during':
                                                            text = t('attendanceSession.attendanceWindow.during');
                                                            icon = 'fas fa-clock';
                                                            break;
                                                        case 'after':
                                                            text = t('attendanceSession.attendanceWindow.after');
                                                            icon = 'fas fa-hourglass-end';
                                                            break;
                                                        case 'early':
                                                            text = t('attendanceSession.attendanceWindow.early');
                                                            icon = 'fas fa-running';
                                                            break;
                                                        case 'late':
                                                            text = t('attendanceSession.attendanceWindow.late');
                                                            icon = 'fas fa-user-clock';
                                                            break;
                                                        case 'late_before':
                                                            text = t('attendanceSession.attendanceWindow.late');
                                                            icon = 'fas fa-user-clock';
                                                            break;
                                                        case 'late_leave':
                                                            text = t('attendanceSession.attendanceWindow.lateLeave');
                                                            icon = 'fas fa-sign-out-alt';
                                                            break;
                                                        default:
                                                            break;
                                                    }

                                                    // Nếu đã tick checkbox "ra ca trực giữa giờ", thay đổi text
                                                    if (isDutyStudent) {
                                                        text = t('attendanceSession.dutyStudent.buttonText');
                                                    }

                                                    return (
                                                        <div className="d-flex align-items-center justify-content-center gap-2">
                                                            {faceVerificationEnabled && (
                                                                <i className="fas fa-user-check" style={{ fontSize: '16px' }}></i>
                                                            )}
                                                            <span>{text}</span>
                                                        </div>
                                                    );
                                                })()}
                                            </span>
                                            <span className="arrow">
                                                <svg width="50px" height="20px" viewBox="0 0 66 43" version="1" xmlns="http://www.w3.org/2000/svg">
                                                    <g id="arrow" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                                                        <path className="one" d="M40.1543933,3.89485454 L43.9763149,0.139296592 C44.1708311,-0.0518420739 44.4826329,-0.0518571125 44.6771675,0.139262789 L65.6916134,20.7848311 C66.0855801,21.1718824 66.0911863,21.8050225 65.704135,22.1989893 L44.677098,42.8607841 C44.4825957,43.0519059 44.1708242,43.0519358 43.9762853,42.8608513 L40.1545186,39.1069479 C39.9575152,38.9134427 39.9546793,38.5968729 40.1481845,38.3998695 L56.9937789,21.8567812 C57.1908028,21.6632968 57.193672,21.3467273 57.0001876,21.1497035 L40.1545208,4.60825197 C39.9574869,4.41477773 39.9546013,4.09820839 40.1480756,3.90117456 Z" fill="#FFFFFF"></path>
                                                        <path className="two" d="M20.1543933,3.89485454 L23.9763149,0.139296592 C24.1708311,-0.0518420739 24.4826329,-0.0518571125 24.6771675,0.139262789 L45.6916134,20.7848311 C46.0855801,21.1718824 46.0911863,21.8050225 45.704135,22.1989893 L24.677098,42.8607841 C24.4825957,43.0519059 24.1708242,43.0519358 23.9762853,42.8608513 L20.1545186,39.1069479 C19.9575152,38.9134427 19.9546793,38.5968729 20.1481845,38.3998695 L36.9937789,21.8567812 C37.1908028,21.6632968 37.193672,21.3467273 37.0001876,21.1497035 L20.1545208,4.60825197 C19.9574869,4.41477773 19.9546013,4.09820839 20.1480756,3.90117456 Z" fill="#FFFFFF"></path>
                                                        <path className="three" d="M0.154393339,3.89485454 L3.97631488,0.139296592 C4.17083111,-0.0518420739 4.48263286,-0.0518571125 4.67716753,0.139262789 L25.6916134,20.7848311 C26.0855801,21.1718824 26.0911863,21.8050225 25.704135,22.1989893 L4.67709797,42.8607841 C4.48259567,43.0519059 4.17082418,43.0519358 3.97628526,42.8608513 L0.154518591,39.1069479 C-0.0424848215,38.9134427 -0.0453206733,38.5968729 0.148184538,38.3998695 L16.9937789,21.8567812 C17.1908028,21.6632968 17.193672,21.3467273 17.0001876,21.1497035 L0.15452076,4.60825197 C-0.0425130651,4.41477773 -0.0453986756,4.09820839 0.148075568,3.90117456 Z" fill="#FFFFFF"></path>
                                                    </g>
                                                </svg>
                                            </span>
                                        </button>

                                        {/* Show message when button is disabled due to VPN/Proxy */}
                                        {vpnStatus && (vpnStatus.isVPN || vpnStatus.isProxy) && (
                                            <div className="modern-alert modern-alert-danger mt-2 mb-0">
                                                <div className="d-flex align-items-center">
                                                    <i className="fas fa-shield-alt me-2"></i>
                                                    <div>{t('attendanceSession.vpnDetection.mustDisable')}</div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Show message when button is disabled due to geofence */}
                                        {session.monitoring_options?.location?.enabled &&
                                            session.monitoring_options?.location?.geofence?.enabled &&
                                            locationData &&
                                            !isWithinGeofence(locationData, session.monitoring_options.location.geofence) && (
                                                <div className="modern-alert modern-alert-danger mt-2 mb-0">
                                                <div className="d-flex align-items-center">
                                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                                    <div>{t('attendanceSession.location.mustBeInRange')}</div>
                                                </div>
                                                </div>
                                            )}

                                    </div>
                                </Form>
                            )}

                            {!isLoggedIn && (
                                <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                                    <div className="rounded-circle bg-primary bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                                        <Lock size={32} className="text-primary" />
                                    </div>
                                    <h5 className="mb-2">{t('attendanceSession.loginRequired')}</h5>
                                    <p className="text-muted mb-4">{t('attendanceSession.loginRequiredDesc')}</p>

                                    <Button
                                        className="modern-btn modern-btn-primary py-2 mb-3 w-100"
                                        onClick={handleLogin}
                                        size="lg"
                                    >
                                        <i className="fas fa-sign-in-alt me-2"></i>
                                        {t('attendanceSession.loginNow')}
                                    </Button>

                                    <div className="d-flex align-items-center my-3">
                                        <hr className="flex-grow-1" />
                                        <span className="mx-3 text-muted small">{t('attendanceSession.or')}</span>
                                        <hr className="flex-grow-1" />
                                    </div>

                                    <div className="d-flex justify-content-center">
                                        <GoogleLogin
                                            onSuccess={async (credentialResponse) => {
                                                try {
                                                    await googleLogin(credentialResponse);
                                                    // After successful login, the page will refresh and show the attendance form
                                                } catch (error) {
                                                    setError(t('attendanceSession.googleLoginFailed'));
                                                }
                                            }}
                                            onError={() => {
                                                setError(t('attendanceSession.googleLoginFailed'));
                                            }}
                                            size="large"
                                            width="300"
                                            text="signin_with"
                                            shape="rectangular"
                                            logo_alignment="center"
                                            locale="vi"
                                        />
                                    </div>
                                </div>
                            )}

                            {!hasLocationPermission && !isGettingLocation && (
                                <div className="modern-alert modern-alert-warning mt-4">
                                    <div className="d-flex align-items-start">
                                        <div className="flex-grow-1">

                                            {locationPermissionDenied && (
                                                <div className="mt-3">
                                                    <div className="fw-medium mb-2 text-danger">⚠️ {t('attendanceSession.location.permissionDeniedTitle')}</div>
                                                    <div className="text-muted small mb-3">
                                                        Để điểm danh, bạn cần cấp quyền truy cập vị trí. Vui lòng làm theo hướng dẫn ở dưới để bật lại quyền truy cập vị trí.
                                                    </div>
                                                    <div className="bg-white rounded-lg p-3 border">
                                                        <div className="row">
                                                            <div className="col-md-6">
                                                                <div className="fw-medium mb-2">
                                                                    Google Chrome
                                                                </div>
                                                                <ol className="small text-muted mb-0">
                                                                    <li>Mở ứng dụng Cài đặt trên điện thoại của bạn</li>
                                                                    <li>Cuộn xuống và chọn Quyền riêng tư & Bảo mật</li>
                                                                    <li>Nhấn vào Dịch vụ định vị</li>
                                                                    <li>Đảm bảo Dịch vụ định vị được bật</li>
                                                                    <li>Cuộn xuống danh sách ứng dụng và chọn Chrome và Google</li>
                                                                    <li>Chọn Trong khi dùng ứng dụng hoặc Luôn luôn</li>
                                                                </ol>
                                                            </div>
                                                            <div className="col-md-6">
                                                                <div className="fw-medium mb-2">
                                                                    Safari
                                                                </div>
                                                                <ol className="small text-muted mb-0">
                                                                    <li>{t('attendanceSession.location.safariSteps.step1')}</li>
                                                                    <img
                                                                        src="/image/huongdan_Safari.png"
                                                                        alt="Hướng dẫn Safari"
                                                                        className="img-fluid rounded border"
                                                                        style={{ maxWidth: '200px' }}
                                                                    />
                                                                    <li>{t('attendanceSession.location.safariSteps.step2')}</li>
                                                                    <img
                                                                        src="/image/huongdan_Safari2.png"
                                                                        alt="Hướng dẫn Safari"
                                                                        className="img-fluid rounded border"
                                                                        style={{ maxWidth: '200px' }}
                                                                    />
                                                                    <li>{t('attendanceSession.location.safariSteps.step3')}</li>
                                                                    <img
                                                                        src="/image/huongdan_Safari3.png"
                                                                        alt="Hướng dẫn Safari"
                                                                        className="img-fluid rounded border"
                                                                        style={{ maxWidth: '200px' }}
                                                                    />
                                                                </ol>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 text-center">
                                                            <button
                                                                className="btn btn-outline-primary btn-sm"
                                                                onClick={() => window.location.reload()}
                                                            >
                                                                <i className="fas fa-sync-alt me-1"></i>
                                                                {t('attendanceSession.location.refreshPage')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                            )}

                        </div>
                        <div className="card-footer bg-white text-center border-0">
                            <small className="text-muted">PCTU-IMS v2.1.2</small>
                        </div>
                    </div>
                </Col>
            </Row>

            {/* Face Verification Modal */}
            <Modal
                show={showFaceVerificationModal}
                onHide={closeFaceVerificationModal}
                size="lg"
                centered
                backdrop="static"
                keyboard={false}
                className="face-verification-modal"
            >
                <Modal.Body className="face-verification-body">
                    <div className="face-verification-container">
                        {/* Camera Preview - Always visible during preview, liveness, action, capturing, verifying, retry */}
                        {(faceVerificationStep === 'preview' || 
                          faceVerificationStep === 'liveness' ||
                          faceVerificationStep === 'action' ||
                          faceVerificationStep === 'capturing' || 
                          faceVerificationStep === 'verifying' || 
                          faceVerificationStep === 'retry') && (
                            <div className="session-card mb-4">
                                <div className="card-body-modern p-0">
                                    <div className="position-relative" style={{ borderRadius: '0', overflow: 'hidden', backgroundColor: '#000' }}>
                                        {/* Subtitle - Top Center */}
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
                                                {faceVerificationStep === 'preview' && t('attendanceSession.faceVerification.preparing')}
                                                {faceVerificationStep === 'liveness' && t('attendanceSession.faceVerification.liveness')}
                                                {faceVerificationStep === 'action' && t('attendanceSession.faceVerification.action')}
                                                {faceVerificationStep === 'capturing' && t('attendanceSession.faceVerification.capturing')}
                                                {faceVerificationStep === 'verifying' && t('attendanceSession.faceVerification.verifying')}
                                                {faceVerificationStep === 'retry' && t('attendanceSession.faceVerification.retry')}
                                            </p>
                                        </div>
                                        
                                        <video
                                            ref={faceVerificationVideoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            style={{
                                                width: '100%',
                                                maxWidth: '100%',
                                                height: 'auto',
                                                display: 'block'
                                            }}
                                        />
                                        <canvas ref={faceVerificationCanvasRef} style={{ display: 'none' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Overlay during liveness, action, capturing/verifying - Moved to card-body-modern */}
                        {(faceVerificationStep === 'liveness' ||
                          faceVerificationStep === 'action' ||
                          faceVerificationStep === 'capturing' || 
                          faceVerificationStep === 'verifying' || 
                          faceVerificationStep === 'retry') && (
                            <div className="card-body-modern pt-3">
                                <div className="d-flex flex-column align-items-center justify-content-center">
                                    <Spinner animation="border" variant="primary" className="mb-3" style={{ width: '3rem', height: '3rem' }} />
                                    <div className="fw-bold mb-3 text-center" style={{ fontSize: '16px', color: '#495057' }}>
                                        {faceVerificationMessage || t('common.processing')}
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
                                    <h5 className="text-success mb-3" style={{ fontSize: '20px', fontWeight: '600' }}>{t('attendanceSession.faceVerification.success')}</h5>
                                    <p className="text-muted mb-0" style={{ fontSize: '15px' }}>{faceVerificationMessage}</p>
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
                                    <h5 className="text-danger mb-3" style={{ fontSize: '20px', fontWeight: '600' }}>{t('attendanceSession.faceVerification.failed')}</h5>
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
                                        <span className="text-muted" style={{ fontSize: '14px'  }}>
                                            {t('attendanceSession.faceVerification.instructions.faceClear')}
                                        </span>
                                    </div>
                                    <div className="info-item-inline">
                                        <span className="text-muted" style={{ fontSize: '14px' }}>
                                            {t('attendanceSession.faceVerification.instructions.lookStraight')}
                                        </span>
                                    </div>
                                    {faceVerificationAttempt > 0 && (
                                        <Alert variant="warning" className="mt-3 mb-0" style={{ fontSize: '14px' }}>
                                            <i className="fas fa-exclamation-triangle me-2"></i>
                                            {t('attendanceSession.faceVerification.attempt', { current: faceVerificationAttempt, max: faceVerificationMaxAttempts })}
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
                                onClick={captureAndVerifyFace}
                                disabled={faceVerificationStep !== 'preview'}
                                className="face-verification-btn-primary face-verification-btn-center"
                            >
                                <Camera size={20} className="me-2" />
                                {t('attendanceSession.faceVerification.captureAndVerify')}
                            </Button>
                        )}
                        {faceVerificationStep === 'error' && (
                            <div className="d-flex gap-3 justify-content-center w-100">
                                <Button
                                    variant="outline-secondary"
                                    onClick={closeFaceVerificationModal}
                                    className="face-verification-btn-cancel"
                                >
                                    <i className="fas fa-times me-2"></i>
                                    {t('attendanceSession.faceVerification.close')}
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={async () => {
                                        // Reset all states
                                        setFaceVerificationStep('preview');
                                        setFaceVerificationProgress(0);
                                        setFaceVerificationMessage('');
                                        setFaceVerificationAttempt(0);
                                        setLivenessStep(1);
                                        setRequiredAction(null);
                                        setPreviousFrame(null);
                                        setDetectedBbox(null);
                                        
                                        // Stop existing camera stream if any
                                        stopFaceVerificationCamera();
                                        
                                        // Wait a bit before restarting
                                        await new Promise(resolve => setTimeout(resolve, 300));
                                        
                                        // Restart camera
                                        await startFaceVerificationCamera();
                                    }}
                                    className="face-verification-btn-primary"
                                >
                                    <i className="fas fa-redo me-2"></i>
                                    {t('attendanceSession.faceVerification.tryAgain')}
                                </Button>
                            </div>
                        )}
                        {faceVerificationStep === 'success' && (
                            <Button
                                variant="success"
                                onClick={closeFaceVerificationModal}
                                className="face-verification-btn-success face-verification-btn-center"
                            >
                                <i className="fas fa-check-circle me-2"></i>
                                {t('attendanceSession.faceVerification.complete')}
                            </Button>
                        )}
                    </div>
                </Modal.Footer>
            </Modal>

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
                                    {t('attendanceSession.faceSampleRequired.title')}
                                </h5>
                                <p className="text-muted mb-0" style={{ fontSize: '15px', lineHeight: '1.6' }}>
                                    {t('attendanceSession.faceSampleRequired.description')}
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
                        {t('attendanceSession.faceSampleRequired.cancel')}
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
                        {t('attendanceSession.faceSampleRequired.register')}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default AttendanceSession;