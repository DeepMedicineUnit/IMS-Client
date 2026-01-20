import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Bell, Moon, Sun, User, Settings, LogOut, ChevronDown, CreditCard, FileText, Shield, Users, Eye, PenTool, Mail, CheckSquare, Ticket } from 'lucide-react';
import './TopHeader.css';

const TopHeader = () => {
  const { currentUser, isLoggedIn, logout, api } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [notifications, setNotifications] = useState(0); // Mock notification count
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [invoiceCount, setInvoiceCount] = useState(5); // Mock invoice count
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null); // Fullscreen image URL
  const [maxVisibleUsers, setMaxVisibleUsers] = useState(12); // Maximum number of users to show before dots
  const [pendingDocumentsCount, setPendingDocumentsCount] = useState(0); // Count of documents with active routes
  const [pendingSignaturesCount, setPendingSignaturesCount] = useState(0); // Count of pending signatures (for manager)
  const [activatedSignaturesCount, setActivatedSignaturesCount] = useState(0); // Count of activated signatures (for user)
  const [unreadDocumentsCount, setUnreadDocumentsCount] = useState(0); // Count of unread documents
  const [unreadSignaturesCount, setUnreadSignaturesCount] = useState(0); // Count of unread signatures (pending for manager)
  const [unreadActivatedSignaturesCount, setUnreadActivatedSignaturesCount] = useState(0); // Count of unread activated signatures (for user)
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState([]);
  const [pendingSignatures, setPendingSignatures] = useState([]); // Pending signatures for manager
  const [activatedSignatures, setActivatedSignatures] = useState([]); // Activated signatures for user
  const [lastViewedAt, setLastViewedAt] = useState(null); // Timestamp of last view for documents
  const [lastViewedSignaturesAt, setLastViewedSignaturesAt] = useState(null); // Timestamp of last view for pending signatures (manager)
  const [lastViewedActivatedSignaturesAt, setLastViewedActivatedSignaturesAt] = useState(null); // Timestamp of last view for activated signatures
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false); // Show logout confirmation modal
  const [ticketNotifications, setTicketNotifications] = useState([]); // Ticket notifications
  const [ticketNotificationsCount, setTicketNotificationsCount] = useState(0); // Count of ticket notifications
  const [unreadTicketNotificationsCount, setUnreadTicketNotificationsCount] = useState(0); // Count of unread ticket notifications
  const [lastViewedTicketsAt, setLastViewedTicketsAt] = useState(null); // Timestamp of last view for ticket notifications
  const [faceUpdateRequests, setFaceUpdateRequests] = useState([]); // Face update requests
  const [faceUpdateRequestsCount, setFaceUpdateRequestsCount] = useState(0); // Count of face update requests
  const [showAllNotificationsModal, setShowAllNotificationsModal] = useState(false); // Show all notifications modal
  const [allNotifications, setAllNotifications] = useState([]); // All notifications for modal

  const handleLogoutClick = () => {
    setShowProfileDropdown(false); // Close profile dropdown
    setShowLogoutConfirm(true); // Show confirmation modal
    // Add class to body to darken IMS rail
    document.body.classList.add('logout-modal-open');
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false); // Close modal
    // Remove class from body
    document.body.classList.remove('logout-modal-open');
    await logout();
    // Small delay to ensure state is cleared before navigation
    setTimeout(() => {
      navigate('/login', { replace: true });
    }, 100);
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false); // Close modal
    // Remove class from body
    document.body.classList.remove('logout-modal-open');
  };

  const toggleProfileDropdown = () => {
    setShowProfileDropdown(!showProfileDropdown);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    // Apply dark mode to document
    if (newDarkMode) {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('darkMode', 'false');
    }
  };

  // Fetch online users
  const fetchOnlineUsers = async () => {
    try {
      const response = await api.get('/system/online-users');
      if (response.data && response.data.success) {
        setOnlineUsers(response.data.data || []);
      } else {
        // If response doesn't have success field, try to use data directly
        if (Array.isArray(response.data)) {
          setOnlineUsers(response.data);
        } else if (response.data && Array.isArray(response.data.data)) {
          setOnlineUsers(response.data.data);
        } else {
          setOnlineUsers([]);
        }
      }
    } catch (error) {
      console.error('Error fetching online users:', error);
      // Set empty array on error to avoid showing stale data
      setOnlineUsers([]);
    }
  };

  // Fetch pending documents count (documents with active routes assigned to user)
  const fetchPendingDocumentsCount = async () => {
    try {
      const response = await api.get('/documents/pending-count');
      if (response.data.success) {
        setPendingDocumentsCount(response.data.count || 0);
      }
    } catch (error) {
      // If user doesn't have permission (403), silently fail - don't log error
      if (error.response?.status !== 403) {
        console.error('Error fetching pending documents count:', error);
      }
      setPendingDocumentsCount(0);
    }
  };

  // Fetch pending signatures count (signatures waiting for approval - for manager)
  const fetchPendingSignaturesCount = async () => {
    try {
      const response = await api.get('/documents/signatures/pending-count');
      if (response.data.success) {
        setPendingSignaturesCount(response.data.count || 0);
      }
    } catch (error) {
      // If user doesn't have permission (403), silently fail - don't log error
      if (error.response?.status !== 403) {
        console.error('Error fetching pending signatures count:', error);
      }
      setPendingSignaturesCount(0);
    }
  };

  // Fetch activated signatures count (signatures that were recently activated - for user)
  const fetchActivatedSignaturesCount = async () => {
    try {
      // Get lastViewed timestamp as ISO string
      const lastViewed = lastViewedActivatedSignaturesAt 
        ? lastViewedActivatedSignaturesAt.toISOString()
        : (() => {
            const saved = localStorage.getItem('notifications_activated_signatures_last_viewed');
            return saved || null;
          })();
      
      const url = lastViewed 
        ? `/documents/signatures/activated-count?last_viewed_at=${encodeURIComponent(lastViewed)}`
        : '/documents/signatures/activated-count';
      
      const response = await api.get(url);
      if (response.data.success) {
        setActivatedSignaturesCount(response.data.count || 0);
      }
    } catch (error) {
      // If user doesn't have permission (403), silently fail - don't log error
      if (error.response?.status !== 403) {
        console.error('Error fetching activated signatures count:', error);
      }
      setActivatedSignaturesCount(0);
    }
  };

  // Fetch pending signatures list (signatures waiting for approval - for manager)
  const fetchPendingSignatures = async (skipUnreadCalculation = false) => {
    try {
      const response = await api.get('/documents/signatures/pending?limit=10');
      if (response.data.success) {
        const signatures = response.data.signatures || [];
        setPendingSignatures(signatures);
        
        // Calculate unread count only if not skipped
        if (!skipUnreadCalculation) {
          // Get current lastViewedSignaturesAt from state or localStorage
          const currentLastViewed = lastViewedSignaturesAt || (() => {
            const saved = localStorage.getItem('notifications_signatures_last_viewed');
            return saved ? new Date(saved) : null;
          })();
          
          if (currentLastViewed) {
            const unreadCount = signatures.filter(sig => {
              if (!sig.created_at) return true;
              const sigCreatedAt = new Date(sig.created_at);
              return sigCreatedAt > currentLastViewed;
            }).length;
            setUnreadSignaturesCount(unreadCount);
          } else {
            // If never viewed, all are unread
            setUnreadSignaturesCount(signatures.length);
          }
        }
      }
    } catch (error) {
      // If user doesn't have permission (403), silently fail - don't log error
      if (error.response?.status !== 403) {
        console.error('Error fetching pending signatures:', error);
      }
      setPendingSignatures([]);
      if (!skipUnreadCalculation) {
        setUnreadSignaturesCount(0);
      }
    }
  };

  // Fetch activated signatures list (signatures that were recently activated - for user)
  const fetchActivatedSignatures = async (skipUnreadCalculation = false) => {
    try {
      // Get lastViewed timestamp as ISO string
      const lastViewed = lastViewedActivatedSignaturesAt 
        ? lastViewedActivatedSignaturesAt.toISOString()
        : (() => {
            const saved = localStorage.getItem('notifications_activated_signatures_last_viewed');
            return saved || null;
          })();
      
      const url = lastViewed 
        ? `/documents/signatures/activated?limit=10&last_viewed_at=${encodeURIComponent(lastViewed)}`
        : '/documents/signatures/activated?limit=10';
      
      const response = await api.get(url);
      if (response.data.success) {
        const signatures = response.data.signatures || [];
        setActivatedSignatures(signatures);
        
        // Calculate unread count only if not skipped
        if (!skipUnreadCalculation) {
          // Get current lastViewedActivatedSignaturesAt from state or localStorage
          const currentLastViewed = lastViewedActivatedSignaturesAt || (() => {
            const saved = localStorage.getItem('notifications_activated_signatures_last_viewed');
            return saved ? new Date(saved) : null;
          })();
          
          if (currentLastViewed) {
            const unreadCount = signatures.filter(sig => {
              if (!sig.verified_at) return false; // Only count signatures with verified_at
              const sigVerifiedAt = new Date(sig.verified_at);
              return sigVerifiedAt > currentLastViewed;
            }).length;
            setUnreadActivatedSignaturesCount(unreadCount);
          } else {
            // If never viewed, all are unread
            setUnreadActivatedSignaturesCount(signatures.length);
          }
        }
      }
    } catch (error) {
      // If user doesn't have permission (403), silently fail - don't log error
      if (error.response?.status !== 403) {
        console.error('Error fetching activated signatures:', error);
      }
      setActivatedSignatures([]);
      if (!skipUnreadCalculation) {
        setUnreadActivatedSignaturesCount(0);
      }
    }
  };

  // Fetch pending documents list (documents with active routes assigned to user)
  const fetchPendingDocuments = async (skipUnreadCalculation = false) => {
    try {
      const response = await api.get('/documents/pending?limit=10');
      if (response.data.success) {
        const documents = response.data.documents || [];
        setPendingDocuments(documents);
        
        // Calculate unread count only if not skipped
        if (!skipUnreadCalculation) {
          // Get current lastViewedAt from state or localStorage
          const currentLastViewed = lastViewedAt || (() => {
            const saved = localStorage.getItem('notifications_last_viewed');
            return saved ? new Date(saved) : null;
          })();
          
          if (currentLastViewed) {
            const unreadCount = documents.filter(doc => {
              if (!doc.created_at) return true;
              const docCreatedAt = new Date(doc.created_at);
              return docCreatedAt > currentLastViewed;
            }).length;
            setUnreadDocumentsCount(unreadCount);
          } else {
            // If never viewed, all are unread
            setUnreadDocumentsCount(documents.length);
          }
        }
      }
    } catch (error) {
      // If user doesn't have permission (403), silently fail - don't log error
      if (error.response?.status !== 403) {
        console.error('Error fetching pending documents:', error);
      }
      setPendingDocuments([]);
      if (!skipUnreadCalculation) {
        setUnreadDocumentsCount(0);
      }
    }
  };

  // Fetch face update requests
  const fetchFaceUpdateRequests = async () => {
    try {
      const response = await api.get('/face-management/my-pending-requests');
      if (response.data.success) {
        setFaceUpdateRequests(response.data.data || []);
        setFaceUpdateRequestsCount(response.data.count || 0);
      }
    } catch (error) {
      // If user doesn't have permission (403), silently fail - don't log error
      if (error.response?.status !== 403) {
        console.error('Error fetching face update requests:', error);
      }
      setFaceUpdateRequests([]);
      setFaceUpdateRequestsCount(0);
    }
  };

  // Fetch ticket notifications count
  const fetchTicketNotificationsCount = async () => {
    try {
      const lastViewed = lastViewedTicketsAt 
        ? lastViewedTicketsAt.toISOString()
        : (() => {
            const saved = localStorage.getItem('notifications_tickets_last_viewed');
            return saved || null;
          })();
      
      const url = lastViewed 
        ? `/tickets/notifications/count?last_viewed_at=${encodeURIComponent(lastViewed)}`
        : '/tickets/notifications/count';
      
      const response = await api.get(url);
      if (response.data.success) {
        setTicketNotificationsCount(response.data.count || 0);
      }
    } catch (error) {
      // If user doesn't have permission (403), silently fail - don't log error
      if (error.response?.status !== 403) {
        console.error('Error fetching ticket notifications count:', error);
      }
      setTicketNotificationsCount(0);
    }
  };

  // Fetch ticket notifications list
  const fetchTicketNotifications = async (skipUnreadCalculation = false) => {
    try {
      const lastViewed = lastViewedTicketsAt 
        ? lastViewedTicketsAt.toISOString()
        : (() => {
            const saved = localStorage.getItem('notifications_tickets_last_viewed');
            return saved || null;
          })();
      
      const url = lastViewed 
        ? `/tickets/notifications?limit=10&last_viewed_at=${encodeURIComponent(lastViewed)}`
        : '/tickets/notifications?limit=10';
      
      const response = await api.get(url);
      if (response.data.success) {
        const tickets = response.data.data || [];
        setTicketNotifications(tickets);
        
        // Calculate unread count only if not skipped
        if (!skipUnreadCalculation) {
          const currentLastViewed = lastViewedTicketsAt || (() => {
            const saved = localStorage.getItem('notifications_tickets_last_viewed');
            return saved ? new Date(saved) : null;
          })();
          
          if (currentLastViewed) {
            const unreadCount = tickets.filter(ticket => {
              const notificationDate = ticket.notification_date || ticket.updated_at || ticket.created_at;
              if (!notificationDate) return true;
              return new Date(notificationDate) > currentLastViewed;
            }).length;
            setUnreadTicketNotificationsCount(unreadCount);
          } else {
            // If never viewed, all are unread
            setUnreadTicketNotificationsCount(tickets.length);
          }
        }
      }
    } catch (error) {
      // If user doesn't have permission (403), silently fail - don't log error
      if (error.response?.status !== 403) {
        console.error('Error fetching ticket notifications:', error);
      }
      setTicketNotifications([]);
      if (!skipUnreadCalculation) {
        setUnreadTicketNotificationsCount(0);
      }
    }
  };

  // Mark notifications as viewed
  const markNotificationsAsViewed = () => {
    const now = new Date();
    setLastViewedAt(now);
    localStorage.setItem('notifications_last_viewed', now.toISOString());
    setUnreadDocumentsCount(0);
  };

  // Mark signature notifications as viewed (pending signatures for manager)
  const markSignatureNotificationsAsViewed = () => {
    const now = new Date();
    setLastViewedSignaturesAt(now);
    localStorage.setItem('notifications_signatures_last_viewed', now.toISOString());
    setUnreadSignaturesCount(0);
  };

  // Mark activated signature notifications as viewed
  const markActivatedSignatureNotificationsAsViewed = () => {
    const now = new Date();
    setLastViewedActivatedSignaturesAt(now);
    localStorage.setItem('notifications_activated_signatures_last_viewed', now.toISOString());
    setUnreadActivatedSignaturesCount(0);
  };

  // Mark ticket notifications as viewed
  const markTicketNotificationsAsViewed = () => {
    const now = new Date();
    setLastViewedTicketsAt(now);
    localStorage.setItem('notifications_tickets_last_viewed', now.toISOString());
    setUnreadTicketNotificationsCount(0);
  };

  // Fetch all notifications for modal
  const fetchAllNotifications = async () => {
    try {
      const [docsResponse, signaturesResponse, activatedSigsResponse, ticketsResponse, faceRequestsResponse] = await Promise.all([
        api.get('/documents/pending?limit=100').catch(() => ({ data: { success: false, documents: [] } })),
        api.get('/documents/signatures/pending?limit=100').catch(() => ({ data: { success: false, signatures: [] } })),
        api.get('/documents/signatures/activated?limit=100').catch(() => ({ data: { success: false, signatures: [] } })),
        api.get('/tickets/notifications?limit=100').catch(() => ({ data: { success: false, data: [] } })),
        api.get('/face-management/my-pending-requests').catch(() => ({ data: { success: false, data: [] } }))
      ]);

      const allNotifs = [];

      // Add face update requests
      if (faceRequestsResponse.data.success && faceRequestsResponse.data.data) {
        faceRequestsResponse.data.data.forEach(request => {
          allNotifs.push({
            type: 'face-update',
            id: `face-${request.id}`,
            title: t('notifications.faceUpdateRequest'),
            description: `${t('notifications.requestedBy')}: ${request.requested_by_name || t('user.admin')}`,
            details: request.notes,
            timestamp: request.requested_at,
            data: request,
            action: () => navigate('/profile')
          });
        });
      }

      // Add ticket notifications
      if (ticketsResponse.data.success && ticketsResponse.data.data) {
        ticketsResponse.data.data.forEach(ticket => {
          allNotifs.push({
            type: 'ticket',
            id: `ticket-${ticket.id}`,
            title: ticket.notification_type === 'assigned' ? t('notifications.ticketAssigned') : t('notifications.newTicket'),
            description: ticket.notification_type === 'assigned' 
              ? `${t('notifications.from')}: ${ticket.creator_name || ticket.creator_username || t('user.student')}`
              : `${t('notifications.code')}: ${ticket.ticket_code || 'N/A'}`,
            details: ticket.title,
            timestamp: ticket.notification_date || ticket.updated_at || ticket.created_at,
            data: ticket,
            action: () => {
              if (currentUser?.role === 'superadmin' || currentUser?.role === 'admin') {
                navigate('/ims/tickets');
              } else {
                navigate('/personal/tickets');
              }
            }
          });
        });
      }

      // Add activated signatures
      if (activatedSigsResponse.data.success && activatedSigsResponse.data.signatures) {
        activatedSigsResponse.data.signatures.forEach(sig => {
          allNotifs.push({
            type: 'activated-signature',
            id: `activated-sig-${sig.id}`,
            title: t('notifications.signatureActivated'),
            description: `${t('notifications.approvedBy')}: ${sig.verifier_name || sig.verifier_username || t('user.admin')}`,
            timestamp: sig.verified_at,
            data: sig,
            action: () => navigate('/personal/documents')
          });
        });
      }

      // Add pending signatures
      if (signaturesResponse.data.success && signaturesResponse.data.signatures) {
        signaturesResponse.data.signatures.forEach(sig => {
          allNotifs.push({
            type: 'pending-signature',
            id: `pending-sig-${sig.id}`,
            title: t('notifications.signaturePending'),
            description: sig.user_name || sig.username || t('user.student'),
            timestamp: sig.created_at,
            data: sig,
            action: () => navigate('/documents?tab=signatures')
          });
        });
      }

      // Add pending documents
      if (docsResponse.data.success && docsResponse.data.documents) {
        docsResponse.data.documents.forEach(doc => {
          allNotifs.push({
            type: 'document',
            id: `doc-${doc.id}`,
            title: doc.document_type || t('notifications.document'),
            description: doc.owner_name || doc.owner_username || t('user.student'),
            details: doc.route_name,
            timestamp: doc.created_at,
            data: doc,
            action: () => navigate('/personal/documents')
          });
        });
      }

      // Sort by timestamp (newest first)
      allNotifs.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp) : new Date(0);
        const timeB = b.timestamp ? new Date(b.timestamp) : new Date(0);
        return timeB - timeA;
      });

      setAllNotifications(allNotifs);
    } catch (error) {
      console.error('Error fetching all notifications:', error);
      setAllNotifications([]);
    }
  };

  // Load last viewed timestamps from localStorage on mount
  useEffect(() => {
    const savedLastViewed = localStorage.getItem('notifications_last_viewed');
    if (savedLastViewed) {
      setLastViewedAt(new Date(savedLastViewed));
    }
    const savedLastViewedSignatures = localStorage.getItem('notifications_signatures_last_viewed');
    if (savedLastViewedSignatures) {
      setLastViewedSignaturesAt(new Date(savedLastViewedSignatures));
    }
    const savedLastViewedActivatedSignatures = localStorage.getItem('notifications_activated_signatures_last_viewed');
    if (savedLastViewedActivatedSignatures) {
      setLastViewedActivatedSignaturesAt(new Date(savedLastViewedActivatedSignatures));
    }
    const savedLastViewedTickets = localStorage.getItem('notifications_tickets_last_viewed');
    if (savedLastViewedTickets) {
      setLastViewedTicketsAt(new Date(savedLastViewedTickets));
    }
  }, []);

  // Fetch initial data after timestamps are loaded
  useEffect(() => {
    const fetchInitialData = async () => {
      await fetchOnlineUsers();
      await fetchPendingDocumentsCount();
      await fetchPendingSignaturesCount();
      await fetchActivatedSignaturesCount();
      await fetchTicketNotificationsCount();
      await fetchFaceUpdateRequests();
      // Fetch pending documents and signatures to calculate unread count
      // Note: timestamps might still be null here, but that's okay - it will be handled in fetch functions
      await fetchPendingDocuments();
      await fetchPendingSignatures();
      await fetchActivatedSignatures();
      await fetchTicketNotifications();
    };
    
    // Only fetch if timestamps have been initialized (either loaded from localStorage or set to null)
    // Use a small delay to ensure localStorage is read first
    const timeout = setTimeout(() => {
      fetchInitialData();
    }, 100);
    
    return () => clearTimeout(timeout);
  }, []); // Only run once on mount

  // Recalculate unread count when lastViewedAt changes (after marking as viewed)
  useEffect(() => {
    if (pendingDocuments.length > 0) {
      // Get current lastViewedAt from state or localStorage
      const currentLastViewed = lastViewedAt || (() => {
        const saved = localStorage.getItem('notifications_last_viewed');
        return saved ? new Date(saved) : null;
      })();
      
      if (currentLastViewed) {
        const unreadCount = pendingDocuments.filter(doc => {
          if (!doc.created_at) return true;
          const docCreatedAt = new Date(doc.created_at);
          return docCreatedAt > currentLastViewed;
        }).length;
        setUnreadDocumentsCount(unreadCount);
      } else {
        // If never viewed, all are unread
        setUnreadDocumentsCount(pendingDocuments.length);
      }
    } else {
      setUnreadDocumentsCount(0);
    }
  }, [pendingDocuments, lastViewedAt]);

  // Recalculate unread signatures count when lastViewedSignaturesAt changes (pending signatures for manager)
  useEffect(() => {
    if (pendingSignatures.length > 0) {
      // Get current lastViewedSignaturesAt from state or localStorage
      const currentLastViewed = lastViewedSignaturesAt || (() => {
        const saved = localStorage.getItem('notifications_signatures_last_viewed');
        return saved ? new Date(saved) : null;
      })();
      
      if (currentLastViewed) {
        const unreadCount = pendingSignatures.filter(sig => {
          if (!sig.created_at) return true;
          const sigCreatedAt = new Date(sig.created_at);
          return sigCreatedAt > currentLastViewed;
        }).length;
        setUnreadSignaturesCount(unreadCount);
      } else {
        // If never viewed, all are unread
        setUnreadSignaturesCount(pendingSignatures.length);
      }
    } else {
      setUnreadSignaturesCount(0);
    }
  }, [pendingSignatures, lastViewedSignaturesAt]);

  // Recalculate unread activated signatures count when lastViewedActivatedSignaturesAt changes
  useEffect(() => {
    if (activatedSignatures.length > 0) {
      // Get current lastViewedActivatedSignaturesAt from state or localStorage
      const currentLastViewed = lastViewedActivatedSignaturesAt || (() => {
        const saved = localStorage.getItem('notifications_activated_signatures_last_viewed');
        return saved ? new Date(saved) : null;
      })();
      
      if (currentLastViewed) {
        const unreadCount = activatedSignatures.filter(sig => {
          if (!sig.verified_at) return false; // Only count signatures with verified_at
          const sigVerifiedAt = new Date(sig.verified_at);
          return sigVerifiedAt > currentLastViewed;
        }).length;
        setUnreadActivatedSignaturesCount(unreadCount);
      } else {
        // If never viewed, all are unread
        setUnreadActivatedSignaturesCount(activatedSignatures.length);
      }
    } else {
      setUnreadActivatedSignaturesCount(0);
    }
  }, [activatedSignatures, lastViewedActivatedSignaturesAt]);

  // Recalculate unread ticket notifications count when lastViewedTicketsAt changes
  useEffect(() => {
    if (ticketNotifications.length > 0) {
      const currentLastViewed = lastViewedTicketsAt || (() => {
        const saved = localStorage.getItem('notifications_tickets_last_viewed');
        return saved ? new Date(saved) : null;
      })();
      
      if (currentLastViewed) {
        const unreadCount = ticketNotifications.filter(ticket => {
          const notificationDate = ticket.notification_date || ticket.updated_at || ticket.created_at;
          if (!notificationDate) return true;
          return new Date(notificationDate) > currentLastViewed;
        }).length;
        setUnreadTicketNotificationsCount(unreadCount);
      } else {
        // If never viewed, all are unread
        setUnreadTicketNotificationsCount(ticketNotifications.length);
      }
    } else {
      setUnreadTicketNotificationsCount(0);
    }
  }, [ticketNotifications, lastViewedTicketsAt]);

  const handleUserClick = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark-mode');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark-mode');
    }
  }, []);

  // Auto-refresh online users, pending documents/signatures count, and recalculate unread count every 30 seconds
  // Only fetch when tab is visible to reduce server load
  useEffect(() => {
    let interval = null;
    let isActive = true;

    const fetchData = async () => {
      // Only fetch if tab is visible
      if (document.hidden || !isActive) {
        return;
      }

      try {
        await Promise.all([
          fetchOnlineUsers(),
          fetchPendingDocumentsCount(),
          fetchPendingSignaturesCount(),
          fetchActivatedSignaturesCount(),
          fetchTicketNotificationsCount(),
          fetchFaceUpdateRequests(),
          // Refresh pending documents and signatures to recalculate unread count
          fetchPendingDocuments(),
          fetchPendingSignatures(),
          fetchActivatedSignatures(),
          fetchTicketNotifications()
        ]);
      } catch (error) {
        console.error('Error fetching data in interval:', error);
        // Don't spam server if there's an error - wait longer before retry
        if (interval) {
          clearInterval(interval);
          // Retry after 60 seconds on error
          interval = setInterval(fetchData, 60000);
        }
      }
    };

    // Initial fetch
    fetchData();

    // Set up interval - increased from 10s to 30s to reduce server load
    interval = setInterval(fetchData, 30000);

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - stop polling to save resources
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      } else {
        // Tab is visible - resume polling
        if (!interval) {
          fetchData(); // Fetch immediately when tab becomes visible
          interval = setInterval(fetchData, 30000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      if (interval) {
        clearInterval(interval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lastViewedAt, lastViewedSignaturesAt, lastViewedActivatedSignaturesAt, lastViewedTicketsAt]);

  // Adjust max visible users based on screen size
  useEffect(() => {
    const updateMaxVisibleUsers = () => {
      const screenWidth = window.innerWidth;
      if (screenWidth < 800) {
        setMaxVisibleUsers(3); // Show max 3 avatars on mobile, then show more-users-chip
      } else if (screenWidth < 1000) {
        setMaxVisibleUsers(3);
      } else if (screenWidth < 1200) {
        setMaxVisibleUsers(4);
      } else {
        setMaxVisibleUsers(12);
      }
    };

    updateMaxVisibleUsers();
    window.addEventListener('resize', updateMaxVisibleUsers);
    
    return () => window.removeEventListener('resize', updateMaxVisibleUsers);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && !event.target.closest('.profile-dropdown')) {
        setShowProfileDropdown(false);
      }
      if (showNotificationsDropdown && !event.target.closest('.notifications-dropdown')) {
        setShowNotificationsDropdown(false);
      }
      if (showLanguageDropdown && !event.target.closest('.language-dropdown')) {
        setShowLanguageDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown, showNotificationsDropdown, showLanguageDropdown]);

  // Handle language change
  const changeLanguage = async (lng) => {
    try {
      // Update i18n immediately for better UX
      i18n.changeLanguage(lng);
      setShowLanguageDropdown(false);
      localStorage.setItem('i18nextLng', lng);
      
      // Save to database if user is logged in
      if (isLoggedIn && currentUser) {
        try {
          await api.put('/profile/language', { language: lng });
        } catch (error) {
          console.error('Error saving language preference to database:', error);
          // Don't show error to user - language change still works with localStorage
        }
      }
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  // Get current language flag - sử dụng cùng URL với dropdown menu
  const getCurrentLanguageFlag = () => {
    const currentLang = i18n.language || 'vi';
    switch (currentLang) {
      case 'vi':
        return 'https://flagcdn.com/w40/vn.png';
      case 'en':
        return 'https://flagcdn.com/w40/gb.png';
      case 'hi':
        return 'https://flagcdn.com/w40/in.png';
      default:
        return 'https://flagcdn.com/w40/vn.png';
    }
  };

  // Get current language name
  const getCurrentLanguageName = () => {
    const currentLang = i18n.language || 'vi';
    switch (currentLang) {
      case 'vi':
        return 'Tiếng Việt';
      case 'en':
        return 'English';
      case 'hi':
        return 'हिन्दी';
      default:
        return 'Tiếng Việt';
    }
  };

  // Cleanup logout modal class on unmount
  useEffect(() => {
    return () => {
      document.body.classList.remove('logout-modal-open');
    };
  }, []);

  // Don't render if user is not logged in
  if (!isLoggedIn) {
    return null;
  }

  return (
    <header className="top-header">
      <div className="header-left">
        {/* Logo or title can go here */}
      </div>
      
      <div className="header-right">
        {/* Online Users Display */}
        {maxVisibleUsers > 0 && (
          <div className="online-users-container">
            {onlineUsers.length > 0 ? (
              <>
                {onlineUsers.slice(0, maxVisibleUsers).map((user, index) => {
                  // Get last name from full_name
                  const lastName = user.full_name 
                    ? user.full_name.trim().split(' ').pop() 
                    : user.username;
                  
                  return (
                    <div 
                      key={user.id} 
                      className="online-user-chip"
                      onClick={() => handleUserClick(user)}
                      title={`${user.full_name || user.username} - ${user.role === 'student' ? t('user.student') : 
                               user.role === 'staff' ? t('user.staff') :
                               user.role === 'admin' ? t('user.admin') : t('user.superAdmin')}`}
                    >
                      {/* Profile Picture */}
                      {user.profile_picture ? (
                        <img 
                          src={user.profile_picture.startsWith('http') ? user.profile_picture : `${window.location.origin}${user.profile_picture}`}
                          alt={lastName}
                          className="online-user-avatar"
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
                      <div 
                        className="online-user-avatar-placeholder"
                        style={{ display: user.profile_picture ? 'none' : 'flex' }}
                      >
                        <User size={14} />
                      </div>
                      
                      {/* Last Name */}
                      <span className="user-name-small">
                        {lastName}
                      </span>
                      <div className="status-dot-small online"></div>
                    </div>
                  );
                })}
              {onlineUsers.length > maxVisibleUsers && (
                <div 
                  className="more-users-chip"
                  onClick={() => {
                    // Show modal with all users
                    setSelectedUser({ 
                      id: 'all-users', 
                      full_name: t('header.allUsers', { count: onlineUsers.length }),
                      users: onlineUsers 
                    });
                    setShowUserModal(true);
                  }}
                  title={t('header.andMore', { count: onlineUsers.length - maxVisibleUsers })}
                >
                  <span className="dots">...</span>
                </div>
              )}
            </>
          ) : (
            <div className="no-online-users-indicator">
              <Users size={16} />
              <span>{t('header.noOnlineUsers')}</span>
            </div>
          )}
          </div>
        )}

        {/* Language Selector */}
        <div className="header-item language-dropdown">
          <button 
            className="header-icon-btn" 
            title={t('common.language')}
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
          >
            <img 
              src={getCurrentLanguageFlag()} 
              alt={getCurrentLanguageName()} 
              className="flag-icon"
              onError={(e) => {
                // Fallback to SVG if API fails
                e.target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRkY0NDQ0Ii8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiIGZpbGw9IiNGRkZGRkYiLz4KPHN0YXIgaWQ9InN0YXIiIGN4PSIxMiIgY3k9IjEyIiByPSIyLjUiIGZpbGw9IiNGRkZGRkYiLz4KPC9zdmc+Cg==";
              }}
            />
          </button>

          {/* Language Dropdown Menu */}
          {showLanguageDropdown && (
            <div className="language-dropdown-menu">
              <div className="language-options">
                <button
                  className={`language-option ${i18n.language === 'vi' ? 'active' : ''}`}
                  onClick={() => changeLanguage('vi')}
                >
                  <img 
                    src="https://flagcdn.com/w40/vn.png" 
                    alt="Tiếng Việt" 
                    className="flag-icon-small"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <span>Tiếng Việt</span>
                  {i18n.language === 'vi' && <span className="check-mark">✓</span>}
                </button>
                <button
                  className={`language-option ${i18n.language === 'en' ? 'active' : ''}`}
                  onClick={() => changeLanguage('en')}
                >
                  <img 
                    src="https://flagcdn.com/w40/gb.png" 
                    alt="English" 
                    className="flag-icon-small"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <span>English</span>
                  {i18n.language === 'en' && <span className="check-mark">✓</span>}
                </button>
                <button
                  className={`language-option ${i18n.language === 'hi' ? 'active' : ''}`}
                  onClick={() => changeLanguage('hi')}
                >
                  <img 
                    src="https://flagcdn.com/w40/in.png" 
                    alt="हिन्दी" 
                    className="flag-icon-small"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <span>हिन्दी</span>
                  {i18n.language === 'hi' && <span className="check-mark">✓</span>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dark Mode Toggle */}
        <div className="header-item">
          <button 
            className="header-icon-btn" 
            onClick={toggleDarkMode}
            title={isDarkMode ? t('common.lightMode') : t('common.darkMode')}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* Notifications */}
        <div className="header-item notifications-dropdown">
          <button 
            className="header-icon-btn notification-btn" 
            title={
              (unreadDocumentsCount + unreadSignaturesCount + unreadActivatedSignaturesCount + unreadTicketNotificationsCount + faceUpdateRequestsCount) > 0 
                ? `${unreadDocumentsCount + unreadSignaturesCount + unreadActivatedSignaturesCount + unreadTicketNotificationsCount + faceUpdateRequestsCount} ${t('header.newNotifications')}` 
                : (pendingDocumentsCount + pendingSignaturesCount + activatedSignaturesCount + ticketNotificationsCount + faceUpdateRequestsCount) > 0 
                  ? `${pendingDocumentsCount + pendingSignaturesCount + activatedSignaturesCount + ticketNotificationsCount + faceUpdateRequestsCount} ${t('header.notifications')}` 
                  : t('header.notifications')
            }
            onClick={async () => {
              if (!showNotificationsDropdown) {
                // Fetch pending documents and signatures when opening dropdown
                await fetchPendingDocuments();
                await fetchPendingSignatures();
                await fetchActivatedSignatures();
                await fetchTicketNotifications();
                await fetchFaceUpdateRequests();
                // Mark as viewed when opening dropdown
                markNotificationsAsViewed();
                markSignatureNotificationsAsViewed();
                markActivatedSignatureNotificationsAsViewed();
                markTicketNotificationsAsViewed();
              }
              setShowNotificationsDropdown(!showNotificationsDropdown);
            }}
          >
            <Bell size={20} />
            {(unreadDocumentsCount + unreadSignaturesCount + unreadActivatedSignaturesCount + unreadTicketNotificationsCount + faceUpdateRequestsCount) > 0 && (
              <span className="notification-badge">{unreadDocumentsCount + unreadSignaturesCount + unreadActivatedSignaturesCount + unreadTicketNotificationsCount + faceUpdateRequestsCount}</span>
            )}
          </button>

          {/* Notifications Dropdown Menu */}
          {showNotificationsDropdown && (
            <div className="notifications-dropdown-menu">
              <div className="dropdown-header">
                <h6>{t('header.notifications')}</h6>
                {(unreadDocumentsCount + unreadSignaturesCount + unreadActivatedSignaturesCount + unreadTicketNotificationsCount + faceUpdateRequestsCount) > 0 && (
                  <span className="notification-count-text">{unreadDocumentsCount + unreadSignaturesCount + unreadActivatedSignaturesCount + unreadTicketNotificationsCount + faceUpdateRequestsCount} {t('header.newNotifications')}</span>
                )}
              </div>
              <div className="dropdown-divider"></div>
              <div className="notifications-list">
                {pendingDocuments.length === 0 && pendingSignatures.length === 0 && activatedSignatures.length === 0 && ticketNotifications.length === 0 && faceUpdateRequests.length === 0 ? (
                  <div className="no-notifications">
                    <Bell size={24} />
                    <p>{t('header.noNotifications')}</p>
                  </div>
                ) : (
                  <>
                    {/* Face Update Requests */}
                    {faceUpdateRequests.map((request) => (
                      <div
                        key={`face-update-${request.id}`}
                        className="notification-item unread"
                        onClick={() => {
                          setShowNotificationsDropdown(false);
                          navigate('/profile');
                        }}
                      >
                        <div className="notification-content">
                          <div className="notification-title">
                            <Shield size={16} />
                            <span>{t('notifications.faceUpdateRequest')}</span>
                          </div>
                          <div className="notification-details">
                            <span className="notification-owner">
                              {t('notifications.requestedBy')}: {request.requested_by_name || t('user.admin')}
                            </span>
                            {request.notes && (
                              <span className="notification-route">
                                • {request.notes.length > 30 ? request.notes.substring(0, 30) + '...' : request.notes}
                              </span>
                            )}
                          </div>
                          <div className="notification-time">
                            {request.requested_at && new Date(request.requested_at).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Ticket Notifications */}
                    {ticketNotifications.map((ticket) => {
                      const isUnread = !lastViewedTicketsAt || (() => {
                        const notificationDate = ticket.notification_date || ticket.updated_at || ticket.created_at;
                        if (!notificationDate) return true;
                        return new Date(notificationDate) > lastViewedTicketsAt;
                      })();
                      return (
                        <div
                          key={`ticket-${ticket.id}-${ticket.notification_type}`}
                          className={`notification-item ${isUnread ? 'unread' : ''}`}
                          onClick={() => {
                            setShowNotificationsDropdown(false);
                            markTicketNotificationsAsViewed();
                            // Navigate based on user role
                            if (currentUser?.role === 'superadmin' || currentUser?.role === 'admin') {
                              navigate('/ims/tickets');
                            } else {
                              navigate('/personal/tickets');
                            }
                          }}
                        >
                          <div className="notification-content">
                            <div className="notification-title">
                              <Ticket size={16} />
                              <span>
                                {ticket.notification_type === 'assigned' 
                                  ? t('notifications.ticketAssigned')
                                  : t('notifications.newTicket')}
                              </span>
                            </div>
                            <div className="notification-details">
                              <span className="notification-owner">
                                {ticket.notification_type === 'assigned' 
                                  ? `${t('notifications.from')}: ${ticket.creator_name || ticket.creator_username || t('user.student')}`
                                  : `${t('notifications.code')}: ${ticket.ticket_code || 'N/A'}`}
                              </span>
                              {ticket.title && (
                                <span className="notification-route">
                                  • {ticket.title.length > 30 ? ticket.title.substring(0, 30) + '...' : ticket.title}
                                </span>
                              )}
                            </div>
                            <div className="notification-time">
                              {ticket.notification_date && new Date(ticket.notification_date).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Activated Signatures (for user - chữ ký đã được kích hoạt) */}
                    {activatedSignatures.map((sig) => {
                      const isUnread = !lastViewedActivatedSignaturesAt || (sig.verified_at && new Date(sig.verified_at) > lastViewedActivatedSignaturesAt);
                      return (
                        <div
                          key={`activated-sig-${sig.id}`}
                          className={`notification-item ${isUnread ? 'unread' : ''}`}
                          onClick={() => {
                            setShowNotificationsDropdown(false);
                            markActivatedSignatureNotificationsAsViewed();
                            navigate('/personal/documents'); // Navigate to Personal Documents page
                          }}
                        >
                          <div className="notification-content">
                            <div className="notification-title">
                              <Shield size={16} />
                              <span>{t('notifications.signatureActivated')}</span>
                            </div>
                            <div className="notification-details">
                              <span className="notification-owner">
                                {t('notifications.approvedBy')}: {sig.verifier_name || sig.verifier_username || t('user.admin')}
                              </span>
                            </div>
                            <div className="notification-time">
                              {sig.verified_at && new Date(sig.verified_at).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Pending Signatures (for manager - chữ ký cần phê duyệt) */}
                    {pendingSignatures.map((sig) => {
                      const isUnread = !lastViewedSignaturesAt || (sig.created_at && new Date(sig.created_at) > lastViewedSignaturesAt);
                      return (
                        <div
                          key={`pending-sig-${sig.id}`}
                          className={`notification-item ${isUnread ? 'unread' : ''}`}
                          onClick={() => {
                            setShowNotificationsDropdown(false);
                            markSignatureNotificationsAsViewed();
                            navigate('/documents?tab=signatures'); // Navigate to Documents page with signatures tab
                          }}
                        >
                          <div className="notification-content">
                            <div className="notification-title">
                              <PenTool size={16} />
                              <span>{t('notifications.signaturePending')}</span>
                            </div>
                            <div className="notification-details">
                              <span className="notification-owner">
                                {sig.user_name || sig.username || t('user.student')}
                              </span>
                            </div>
                            <div className="notification-time">
                              {sig.created_at && new Date(sig.created_at).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Pending Documents */}
                    {pendingDocuments.map((doc) => {
                      const isUnread = !lastViewedAt || (doc.created_at && new Date(doc.created_at) > lastViewedAt);
                      return (
                        <div
                          key={`doc-${doc.id}`}
                          className={`notification-item ${isUnread ? 'unread' : ''}`}
                          onClick={() => {
                            setShowNotificationsDropdown(false);
                            markNotificationsAsViewed();
                            navigate('/personal/documents');
                          }}
                        >
                          <div className="notification-content">
                            <div className="notification-title">
                              <FileText size={16} />
                              <span>{doc.document_type || t('notifications.document')}</span>
                            </div>
                            <div className="notification-details">
                              <span className="notification-owner">
                                {doc.owner_name || doc.owner_username || t('user.student')}
                              </span>
                              {doc.route_name && (
                                <span className="notification-route">
                                  • {doc.route_name}
                                </span>
                              )}
                            </div>
                            <div className="notification-time">
                              {doc.created_at && new Date(doc.created_at).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              {(pendingDocumentsCount > 0 || pendingSignaturesCount > 0 || activatedSignaturesCount > 0 || ticketNotificationsCount > 0 || faceUpdateRequestsCount > 0) && (
                <>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-footer">
                    <button
                      className="view-all-btn"
                      onClick={async () => {
                        setShowNotificationsDropdown(false);
                        await fetchAllNotifications();
                        setShowAllNotificationsModal(true);
                      }}
                    >
                      {t('header.viewAllNotifications')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="header-item profile-dropdown">
          <button 
            className="profile-btn" 
            onClick={toggleProfileDropdown}
            title={t('common.profile')}
          >
            <div className="profile-avatar">
              {currentUser?.profile_picture ? (
                <img 
                  src={currentUser.profile_picture.startsWith('http') ? currentUser.profile_picture : `${window.location.origin}${currentUser.profile_picture}`}
                  alt="Profile" 
                  className="avatar-img"
                  onError={(e) => {
                    if (e.target && e.target.style) {
                      e.target.style.display = 'none';
                    }
                  }}
                />
              ) : (
                <User size={20} />
              )}
            </div>
            <span className="profile-name">
              {currentUser?.full_name || currentUser?.username || 'User'}
            </span>
            <ChevronDown size={16} className={`chevron ${showProfileDropdown ? 'rotated' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {showProfileDropdown && (
            <div className="profile-dropdown-menu">
              <div className="dropdown-items">
                <Link to="/profile" className="dropdown-item" onClick={() => setShowProfileDropdown(false)}>
                  <User size={18} />
                  <span>{t('header.myProfile')}</span>
                </Link>
                <button className="dropdown-item logout-btn" onClick={handleLogoutClick}>
                  <span>{t('header.logout')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={cancelLogout}>
          <div className="logout-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="logout-modal-header">
              <h5>{t('header.logoutConfirm')}</h5>
              <button 
                className="modal-close-btn"
                onClick={cancelLogout}
              >
                ×
              </button>
            </div>
            <div className="logout-modal-body">
              <p>{t('header.logoutConfirmMessage')}</p>
            </div>
            <div className="logout-modal-footer">
              <button className="logout-cancel-btn" onClick={cancelLogout}>
                {t('common.cancel')}
              </button>
              <button className="logout-confirm-btn" onClick={confirmLogout}>
                {t('header.logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Notifications Modal */}
      {showAllNotificationsModal && (
        <div className="modal-overlay" onClick={() => setShowAllNotificationsModal(false)}>
          <div className="all-notifications-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5>{t('header.viewAllNotifications')}</h5>
              <button 
                className="modal-close-btn"
                onClick={() => setShowAllNotificationsModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {allNotifications.length === 0 ? (
                <div className="no-notifications">
                  <Bell size={48} />
                  <p>{t('header.noNotifications')}</p>
                </div>
              ) : (
                <div className="all-notifications-list">
                  {allNotifications.map((notification) => {
                    // Determine if notification is unread
                    let isUnread = false;
                    if (notification.type === 'face-update') {
                      isUnread = true; // Face update requests are always shown as unread
                    } else if (notification.type === 'ticket') {
                      const currentLastViewed = lastViewedTicketsAt || (() => {
                        const saved = localStorage.getItem('notifications_tickets_last_viewed');
                        return saved ? new Date(saved) : null;
                      })();
                      isUnread = !currentLastViewed || (notification.timestamp && new Date(notification.timestamp) > currentLastViewed);
                    } else if (notification.type === 'activated-signature') {
                      const currentLastViewed = lastViewedActivatedSignaturesAt || (() => {
                        const saved = localStorage.getItem('notifications_activated_signatures_last_viewed');
                        return saved ? new Date(saved) : null;
                      })();
                      isUnread = !currentLastViewed || (notification.timestamp && new Date(notification.timestamp) > currentLastViewed);
                    } else if (notification.type === 'pending-signature') {
                      const currentLastViewed = lastViewedSignaturesAt || (() => {
                        const saved = localStorage.getItem('notifications_signatures_last_viewed');
                        return saved ? new Date(saved) : null;
                      })();
                      isUnread = !currentLastViewed || (notification.timestamp && new Date(notification.timestamp) > currentLastViewed);
                    } else if (notification.type === 'document') {
                      const currentLastViewed = lastViewedAt || (() => {
                        const saved = localStorage.getItem('notifications_last_viewed');
                        return saved ? new Date(saved) : null;
                      })();
                      isUnread = !currentLastViewed || (notification.timestamp && new Date(notification.timestamp) > currentLastViewed);
                    }

                    return (
                      <div
                        key={notification.id}
                        className={`notification-item-modal ${isUnread ? 'unread' : ''}`}
                        onClick={() => {
                          setShowAllNotificationsModal(false);
                          if (notification.action) {
                            notification.action();
                          }
                        }}
                      >
                        <div className="notification-icon">
                          {notification.type === 'face-update' && <Shield size={20} />}
                          {notification.type === 'ticket' && <Ticket size={20} />}
                          {notification.type === 'activated-signature' && <Shield size={20} />}
                          {notification.type === 'pending-signature' && <PenTool size={20} />}
                          {notification.type === 'document' && <FileText size={20} />}
                        </div>
                        <div className="notification-content-modal">
                          <div className="notification-title-modal">{notification.title}</div>
                          <div className="notification-description-modal">{notification.description}</div>
                          {notification.details && (
                            <div className="notification-details-modal">{notification.details}</div>
                          )}
                          <div className="notification-time-modal">
                            {notification.timestamp && new Date(notification.timestamp).toLocaleString('vi-VN')}
                          </div>
                        </div>
                        {isUnread && <div className="unread-indicator"></div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5>
                {selectedUser.id === 'all-users' ? t('header.allOnlineUsers') : t('header.userInfo')}
              </h5>
              <button 
                className="modal-close-btn"
                onClick={() => setShowUserModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {selectedUser.id === 'all-users' ? (
                // Show all users list
                <div className="all-users-list">
                  <div className="users-grid">
                    {selectedUser.users.map((user, index) => (
                      <div key={user.id} className="user-card" onClick={() => {
                        setSelectedUser(user);
                      }}>
                        <div className="user-avatar-medium">
                          {user.profile_picture ? (
                            <img 
                              src={user.profile_picture} 
                              alt={user.full_name || user.username}
                              className="avatar-img-medium"
                            />
                          ) : (
                            <div className="avatar-placeholder-medium">
                              <User size={24} />
                            </div>
                          )}
                        </div>
                        <div className="user-info-card">
                          <div className="user-name-card">
                            {user.role === 'student' 
                              ? (user.full_name ? user.full_name.split(' ').pop() : user.username)
                              : (user.full_name || user.username)
                            }
                          </div>
                          <div className="user-role-card">
                            {user.role === 'student' ? t('user.student') : 
                             user.role === 'staff' ? t('user.staff') :
                             user.role === 'admin' ? t('user.admin') : t('user.superAdmin')}
                          </div>
                          <div className="user-status-card">
                            <div className="status-dot online"></div>
                            <span>{t('user.active')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Show single user details
                <div className="user-details">
                  {/* Profile Picture */}
                  {selectedUser.profile_picture && (
                    <div className="user-profile-picture-container">
                      <img 
                        src={selectedUser.profile_picture.startsWith('http') 
                          ? selectedUser.profile_picture 
                          : `${window.location.origin}${selectedUser.profile_picture}`}
                        alt={selectedUser.full_name || selectedUser.username}
                        className="user-profile-picture"
                        onClick={() => {
                          const imageUrl = selectedUser.profile_picture.startsWith('http') 
                            ? selectedUser.profile_picture 
                            : `${window.location.origin}${selectedUser.profile_picture}`;
                          setFullscreenImage(imageUrl);
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  )}
                  
                  <div className="user-info-details">
                    <div className="info-row">
                      <label>{t('user.fullName')}:</label>
                      <span>{selectedUser.full_name || t('user.notUpdated')}</span>
                    </div>
                    <div className="info-row">
                      <label>{t('user.email')}:</label>
                      <span>{selectedUser.email || t('user.notUpdated')}</span>
                    </div>
                    <div className="info-row">
                      <label>{t('user.class')}:</label>
                      <span>{selectedUser.class_name || t('user.notUpdated')}</span>
                    </div>
                    <div className="info-row">
                      <label>{t('user.group')}:</label>
                      <span>{selectedUser.group_name || t('user.notUpdated')}</span>
                    </div>
                    <div className="info-row">
                      <label>{t('user.department')}:</label>
                      <span>{selectedUser.department || t('user.notUpdated')}</span>
                    </div>
                    <div className="info-row">
                      <label>{t('user.role')}:</label>
                      <span className={`role-badge ${selectedUser.role}`}>
                        {selectedUser.role === 'student' ? t('user.student') : 
                         selectedUser.role === 'staff' ? t('user.staff') :
                         selectedUser.role === 'admin' ? t('user.admin') : t('user.superAdmin')}
                      </span>
                    </div>
                    <div className="info-row">
                      <label>{t('user.status')}:</label>
                      <span className="status-online">
                        <div className="status-dot online"></div>
                        {t('user.active')}
                      </span>
                    </div>
                    <div className="info-row">
                      <label>{t('user.lastActivity')}:</label>
                      <span>{selectedUser.last_activity ? 
                        new Date(selectedUser.last_activity).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : i18n.language === 'hi' ? 'hi-IN' : 'en-US') : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            cursor: 'pointer'
          }}
          onClick={() => setFullscreenImage(null)}
        >
          <img 
            src={fullscreenImage}
            alt="Profile"
            className="fullscreen-profile-image"
            style={{
              minWidth: '250px',
              minHeight: '250px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              pointerEvents: 'none',
              userSelect: 'none'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </header>
  );
};

export default TopHeader;
