import api, { getApiBaseURL } from './api';

/**
 * Activity Tracker Utility
 * Tự động tracking các hoạt động của user trên client
 */

class ActivityTracker {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.pageStartTime = Date.now();
    this.currentPage = window.location.pathname;
    this.activityBuffer = [];
    this.bufferSize = 3; // Gửi batch sau 3 activities để hiển thị nhanh hơn, ít bỏ qua
    this.flushInterval = 5000; // Gửi batch mỗi 5 giây (trước 30s gây delay lâu)
    this.flushSoonTimer = null; // Flush sau 0.8s khi có activity mới (để 1-2 hành động vẫn gửi kịp, giảm bỏ qua)
    this.hoverStartTime = null;
    this.hoverElement = null;
    this.scrollDepth = 0;
    this.maxScrollDepth = 0;
    this.isTracking = false;
    this.loggingEnabled = true; // Default to enabled
    this.settingsCheckInterval = null; // Interval để kiểm tra setting định kỳ
    
    // Lưu bound functions để có thể remove đúng
    this.boundHandlers = {
      click: this.handleClick.bind(this),
      mouseover: this.handleMouseOver.bind(this),
      mouseout: this.handleMouseOut.bind(this),
      scroll: this.handleScroll.bind(this),
      visibilitychange: this.handleVisibilityChange.bind(this),
      beforeunload: () => {
        this.trackPageDuration();
        this.flushBuffer(true); // Sync flush
      }
    };
    
    // Debounce/throttle để tránh duplicate logs
    this.lastClickTime = {};
    this.lastHoverTime = {};
    this.clickDebounceTime = 150; // 150ms debounce cho clicks (chỉ gộp double-click cùng element, không gộp khác element)
    this.hoverDebounceTime = 400; // 400ms debounce cho hovers
    
    // Auto flush buffer periodically
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.flushInterval);

    // Flush before page unload
    window.addEventListener('beforeunload', this.boundHandlers.beforeunload);
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Kiểm tra cài đặt activity logging từ server
   * Dùng /activity/settings/status (mọi user đăng nhập đều gọi được), không dùng /activity/settings (chỉ superadmin)
   */
  async checkLoggingEnabled() {
    try {
      const response = await api.get('/activity/settings/status');
      if (response.data.success) {
        this.loggingEnabled = response.data.data?.activityLoggingEnabled !== false;
      }
    } catch (error) {
      console.warn('⚠️ [ActivityTracker] Could not check logging settings, defaulting to enabled:', error);
      this.loggingEnabled = true; // Default to enabled on error
    }
  }

  /**
   * Khởi tạo tracking
   */
  async initialize(user) {
    // Luôn cập nhật user info, kể cả khi đã tracking
    const previousUser = this.user;
    this.user = user;
    
    // Kiểm tra cài đặt logging
    await this.checkLoggingEnabled();
    
    // Kiểm tra định kỳ mỗi 5 phút
    if (this.settingsCheckInterval) {
      clearInterval(this.settingsCheckInterval);
    }
    this.settingsCheckInterval = setInterval(() => {
      this.checkLoggingEnabled();
    }, 5 * 60 * 1000); // 5 phút
    

    
    if (this.isTracking) {
      return; // Đã tracking rồi, chỉ cập nhật user info
    }
    
    // Nếu đã tracking, remove listeners cũ trước khi add mới
    if (this.isTracking) {
      this.removeEventListeners();
    }
    
    this.isTracking = true;
    
    // Track clicks với bound handler đã lưu
    document.addEventListener('click', this.boundHandlers.click, { passive: true });
    
    // Track hover với bound handler đã lưu
    document.addEventListener('mouseover', this.boundHandlers.mouseover, { passive: true });
    document.addEventListener('mouseout', this.boundHandlers.mouseout, { passive: true });
    
    // Track scroll với bound handler đã lưu
    window.addEventListener('scroll', this.boundHandlers.scroll, { passive: true });
    
    // Track page visibility với bound handler đã lưu
    document.addEventListener('visibilitychange', this.boundHandlers.visibilitychange);
    
    
  }

  /**
   * Remove event listeners
   */
  removeEventListeners() {
    document.removeEventListener('click', this.boundHandlers.click);
    document.removeEventListener('mouseover', this.boundHandlers.mouseover);
    document.removeEventListener('mouseout', this.boundHandlers.mouseout);
    window.removeEventListener('scroll', this.boundHandlers.scroll);
    document.removeEventListener('visibilitychange', this.boundHandlers.visibilitychange);
  }

  /**
   * Dừng tracking
   */
  stop() {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    clearInterval(this.flushTimer);
    if (this.settingsCheckInterval) {
      clearInterval(this.settingsCheckInterval);
      this.settingsCheckInterval = null;
    }
    this.trackPageDuration();
    this.flushBuffer(true);
    
    // Remove event listeners với bound handlers đã lưu
    this.removeEventListeners();
    
    console.log('Activity Tracker stopped');
  }

  /**
   * Ghi log một activity
   */
  async logActivity(activity) {
    // Kiểm tra xem logging có được bật không
    if (!this.loggingEnabled) {
      return; // Skip logging nếu đã tắt
    }

    // Đảm bảo user info luôn được thêm vào
    // Luôn lấy từ this.user hiện tại (có thể đã được update)
    // Ưu tiên full_name (Họ và tên đầy đủ), sau đó username, cuối cùng email
    const userInfo = {
      user_id: this.user?.id || null,
      username: this.user?.full_name || this.user?.username || this.user?.email || null,
      user_role: this.user?.role || null,
      // Gửi thêm full_name và email riêng để server có thể sử dụng
      full_name: this.user?.full_name || null,
      email: this.user?.email || null
    };

    
    const logData = {
      ...activity,
      ...userInfo, // Override với user info từ tracker (đảm bảo luôn có user info mới nhất)
      session_id: this.sessionId,
      page_url: window.location.href,
      origin: window.location.origin,
      timestamp: new Date().toISOString()
    };

    // Thêm vào buffer
    this.activityBuffer.push(logData);

    // Flush ngay nếu buffer đủ
    if (this.activityBuffer.length >= this.bufferSize) {
      if (this.flushSoonTimer) {
        clearTimeout(this.flushSoonTimer);
        this.flushSoonTimer = null;
      }
      await this.flushBuffer();
      return;
    }

    // Nếu chưa đủ buffer: hẹn flush sau 0.8s để hành động đơn lẻ vẫn được gửi sớm (giảm bỏ qua)
    if (!this.flushSoonTimer) {
      this.flushSoonTimer = setTimeout(() => {
        this.flushSoonTimer = null;
        if (this.activityBuffer.length > 0) {
          this.flushBuffer();
        }
      }, 800);
    }
  }

  /**
   * Gửi buffer lên server
   */
  async flushBuffer(sync = false) {
    if (this.activityBuffer.length === 0) return;
    if (this.flushSoonTimer) {
      clearTimeout(this.flushSoonTimer);
      this.flushSoonTimer = null;
    }

    const activities = [...this.activityBuffer];
    this.activityBuffer = [];

    // Debug: Kiểm tra user info trong activities
    if (activities.length > 0) {
      const firstActivity = activities[0];
    }

    try {
      if (sync) {
        // Khi page unload: dùng fetch keepalive để gửi kèm Authorization (sendBeacon không gửi được header -> 401 -> mất log)
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
        const base = typeof getApiBaseURL === 'function' ? getApiBaseURL() : '/api';
        const url = `${base}/activity/log/batch`;
        if (token) {
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ activities }),
            keepalive: true
          }).catch(() => {});
        } else {
          const blob = new Blob([JSON.stringify({ activities })], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        }
      } else {
        // Async send - có thể gửi với auth headers
        await api.post('/activity/log/batch', { activities });
      }
    } catch (error) {
      console.error('Failed to flush activity buffer:', error);
      // Đưa lại vào buffer nếu gửi thất bại
      this.activityBuffer.unshift(...activities);
    }
  }

  /**
   * Handle click events
   */
  handleClick(event) {
    if (!this.isTracking || !this.loggingEnabled) return;

    const target = event.target;
    const targetInfo = this.getElementInfo(target);
    const displayName = this.getElementDisplayName(target);
    // Key gồm selector + nội dung hiển thị (để 2 nút khác nhau không bị gộp thành 1) + bucket thời gian
    const textPart = (displayName || target.innerText || target.value || '').toString().trim().slice(0, 40);
    const clickKey = `${targetInfo.selector}_${textPart}_${Math.floor(event.timeStamp / this.clickDebounceTime)}`;
    const now = Date.now();
    
    // Debounce: chỉ log nếu chưa log cùng element (cùng selector+text) trong khoảng thời gian debounce
    if (this.lastClickTime[clickKey] && (now - this.lastClickTime[clickKey]) < this.clickDebounceTime) {
      return; // Skip duplicate click
    }
    
    this.lastClickTime[clickKey] = now;
    
    // Cleanup old entries (giữ tối đa 100 entries)
    if (Object.keys(this.lastClickTime).length > 100) {
      const oldestKey = Object.keys(this.lastClickTime).sort((a, b) => 
        this.lastClickTime[a] - this.lastClickTime[b]
      )[0];
      delete this.lastClickTime[oldestKey];
    }
    
    // Lấy tên hiển thị của element (đã gọi getElementDisplayName ở trên cho clickKey)
    const tableName = this.getTableName(target);
    
    // Tạo description rõ ràng
    let description = '';
    if (displayName) {
      if (tableName) {
        description = `Đã click vào "${displayName}" trong ${tableName}`;
      } else if (target.tagName === 'BUTTON') {
        description = `Đã click vào nút "${displayName}"`;
      } else if (target.tagName === 'A') {
        description = `Đã click vào liên kết "${displayName}"`;
      } else if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
        description = `Đã click vào ${target.type || target.tagName.toLowerCase()} "${displayName}"`;
      } else {
        description = `Đã click vào "${displayName}"`;
      }
    } else {
      // Fallback về selector nếu không có display name
      if (tableName) {
        description = `Đã click vào ${targetInfo.selector} trong ${tableName}`;
      } else {
        description = `Đã click vào ${targetInfo.selector}`;
      }
    }
    
    this.logActivity({
      event_context: 'interaction',
      event_type: 'click',
      event_name: 'element_click',
      component: this.getCurrentComponent(),
      description,
      target_element: targetInfo.selector,
      coordinates: {
        x: event.clientX,
        y: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY
      },
      event_data: {
        element: targetInfo,
        displayName,
        tableName,
        text: target.innerText?.substring(0, 100),
        href: target.href
      }
    });
  }

  /**
   * Handle mouse over events
   */
  handleMouseOver(event) {
    if (!this.isTracking || !this.loggingEnabled) return;

    const target = event.target;
    
    // Chỉ track hover cho interactive elements
    if (!this.isInteractiveElement(target)) return;

    // Debounce: chỉ bắt đầu hover nếu chưa hover element này gần đây
    const hoverKey = this.getElementInfo(target).selector;
    const now = Date.now();
    
    if (this.lastHoverTime[hoverKey] && (now - this.lastHoverTime[hoverKey]) < this.hoverDebounceTime) {
      return; // Skip duplicate hover start
    }
    
    this.lastHoverTime[hoverKey] = now;
    this.hoverStartTime = Date.now();
    this.hoverElement = target;
    
    // Cleanup old entries
    if (Object.keys(this.lastHoverTime).length > 50) {
      const oldestKey = Object.keys(this.lastHoverTime).sort((a, b) => 
        this.lastHoverTime[a] - this.lastHoverTime[b]
      )[0];
      delete this.lastHoverTime[oldestKey];
    }
  }

  /**
   * Handle mouse out events
   */
  handleMouseOut(event) {
    if (!this.isTracking || !this.hoverStartTime) return;

    const target = event.target;
    if (target !== this.hoverElement) return;

    const hoverDuration = Date.now() - this.hoverStartTime;
    
    // Chỉ log nếu hover > 500ms và đảm bảo không duplicate
    if (hoverDuration > 500) {
      const targetInfo = this.getElementInfo(target);
      const hoverKey = `${targetInfo.selector}_${Math.floor(this.hoverStartTime / this.hoverDebounceTime)}`;
      
      // Kiểm tra xem đã log hover này chưa
      if (!this.lastHoverTime[hoverKey] || (Date.now() - this.lastHoverTime[hoverKey]) > this.hoverDebounceTime) {
        // Lấy tên hiển thị của element
        const displayName = this.getElementDisplayName(target);
        const tableName = this.getTableName(target);
        const hoverDurationSeconds = Math.round(hoverDuration / 100) / 10; // Làm tròn đến 0.1 giây
        
        // Tạo description rõ ràng
        let description = '';
        if (displayName) {
          if (tableName) {
            description = `Đã hover vào "${displayName}" trong ${tableName} trong ${hoverDurationSeconds} giây`;
          } else if (target.tagName === 'BUTTON') {
            description = `Đã hover vào nút "${displayName}" trong ${hoverDurationSeconds} giây`;
          } else if (target.tagName === 'A') {
            description = `Đã hover vào liên kết "${displayName}" trong ${hoverDurationSeconds} giây`;
          } else {
            description = `Đã hover vào "${displayName}" trong ${hoverDurationSeconds} giây`;
          }
        } else {
          // Fallback về selector
          if (tableName) {
            description = `Đã hover vào ${targetInfo.selector} trong ${tableName} trong ${hoverDurationSeconds} giây`;
          } else {
            description = `Đã hover vào ${targetInfo.selector} trong ${hoverDurationSeconds} giây`;
          }
        }
        
        this.logActivity({
          event_context: 'interaction',
          event_type: 'hover',
          event_name: 'element_hover',
          component: this.getCurrentComponent(),
          description,
          target_element: targetInfo.selector,
          hover_duration: hoverDuration,
          coordinates: {
            x: event.clientX,
            y: event.clientY
          },
          event_data: {
            element: targetInfo,
            displayName,
            tableName
          }
        });
        
        // Đánh dấu đã log
        this.lastHoverTime[hoverKey] = Date.now();
      }
    }

    this.hoverStartTime = null;
    this.hoverElement = null;
  }

  /**
   * Handle scroll events
   */
  handleScroll() {
    if (!this.isTracking || !this.loggingEnabled) return;

    // Throttle scroll tracking
    if (this.scrollTimeout) return;
    
    this.scrollTimeout = setTimeout(() => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrollDepth = Math.round((scrollTop / scrollHeight) * 100);

      if (scrollDepth > this.maxScrollDepth) {
        this.maxScrollDepth = scrollDepth;
        
        // Log milestone scrolls (25%, 50%, 75%, 100%)
        if ([25, 50, 75, 100].includes(scrollDepth)) {
          const pageName = this.getPageName();
          this.logActivity({
            event_context: 'interaction',
            event_type: 'scroll',
            event_name: 'scroll_depth',
            component: this.getCurrentComponent(),
            description: `Đã scroll đến ${scrollDepth}% trang "${pageName}"`,
            scroll_depth: scrollDepth,
            event_data: {
              scrollTop,
              scrollHeight,
              milestone: scrollDepth,
              pageName
            }
          });
        }
      }

      this.scrollTimeout = null;
    }, 500);
  }

  /**
   * Handle visibility change
   */
  handleVisibilityChange() {
    if (!this.isTracking || !this.loggingEnabled) return;

    if (document.hidden) {
      // Page hidden - track duration
      this.trackPageDuration();
    } else {
      // Page visible again - reset timer
      this.pageStartTime = Date.now();
    }
  }

  /**
   * Track page duration
   */
  trackPageDuration() {
    const duration = Math.round((Date.now() - this.pageStartTime) / 1000); // seconds
    
    if (duration > 1) { // Chỉ log nếu > 1 giây
      // Lấy pageName từ currentPage path, không phải từ getPageName() (vì có thể đã chuyển trang)
      const pageName = this.getPageNameFromPath(this.currentPage);
      const durationText = duration < 60 
        ? `${duration} giây` 
        : duration < 3600 
          ? `${Math.floor(duration / 60)} phút ${duration % 60} giây`
          : `${Math.floor(duration / 3600)} giờ ${Math.floor((duration % 3600) / 60)} phút`;
      
      this.logActivity({
        event_context: 'navigation',
        event_type: 'page_view',
        event_name: 'page_duration',
        component: this.getCurrentComponent(),
        description: `Đã ở trang "${pageName}" trong ${durationText}`,
        page_duration: duration,
        scroll_depth: this.maxScrollDepth,
        event_data: {
          path: this.currentPage,
          pageName,
          duration,
          maxScrollDepth: this.maxScrollDepth
        }
      });
    }
  }

  /**
   * Helper: Get page name from path (for page duration tracking)
   */
  getPageNameFromPath(path) {
    const routeNames = {
      '/personal/dashboard': 'Trang chủ cá nhân',
      '/personal/documents': 'Tài liệu cá nhân',
      '/personal/tickets': 'Yêu cầu hỗ trợ',
      '/personal/notifications': 'Thông báo',
      '/personal/attendance': 'Điểm danh cá nhân',
      '/personal/profile': 'Hồ sơ cá nhân',
      '/personal/tasks': 'Nhiệm vụ',
      '/personal/requests': 'Yêu cầu',
      '/student/attendance': 'Điểm danh',
      '/student/exams': 'Thi cử',
      '/student/courses': 'Khóa học',
      '/student/grades': 'Điểm số',
      '/admin/dashboard': 'Trang quản trị',
      '/superadmin/systempage': 'Cài đặt hệ thống',
      '/superadmin/users': 'Quản lý người dùng',
      '/ims/dashboard': 'Trang chủ IMS'
    };

    if (routeNames[path]) {
      return routeNames[path];
    }

    // Format từ path
    const segments = path.split('/').filter(Boolean);
    if (segments.length > 0) {
      return segments.map(s => {
        return s
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }).join(' - ');
    }

    return 'Trang chủ';
  }

  /**
   * Track page navigation
   */
  trackPageView(page, component = null) {
    // Chỉ track khi thực sự điều hướng đến trang mới
    // Không track lại nếu đang ở cùng trang (tránh duplicate logs khi component re-render)
    if (this.currentPage === page) {
      // Đang ở lại cùng trang, không cần log lại
      return;
    }

    // Track previous page duration nếu có trang trước đó
    if (this.currentPage && this.currentPage !== page) {
      this.trackPageDuration();
    }

    // Cập nhật trang hiện tại và reset timer
    this.currentPage = page;
    this.pageStartTime = Date.now();
    this.maxScrollDepth = 0;

    // Chỉ log khi thực sự điều hướng đến trang mới
    const pageName = this.getPageName();
    this.logActivity({
      event_context: 'navigation',
      event_type: 'page_view',
      event_name: 'page_enter',
      component: component || this.getCurrentComponent(),
      description: `Đã điều hướng đến trang "${pageName}"`,
      event_data: {
        path: page,
        pageName,
        referrer: document.referrer,
        title: document.title
      }
    });
  }

  /**
   * Track login
   */
  trackLogin(username, method = 'password') {
    // Chuyển đổi method name sang tiếng Việt
    const methodNames = {
      'password': 'mật khẩu',
      'email': 'email',
      'google': 'Google',
      'qr': 'QR Code',
      'anonymous': 'ẩn danh'
    };
    
    const methodName = methodNames[method] || method;
    
    this.logActivity({
      event_context: 'authentication',
      event_type: 'login',
      event_name: 'user_login',
      component: 'Đăng nhập',
      description: `Người dùng ${username} đã đăng nhập bằng ${methodName}`,
      event_data: {
        username,
        method,
        loginTime: new Date().toISOString()
      }
    });
  }

  /**
   * Track logout
   */
  trackLogout(username) {
    this.logActivity({
      event_context: 'authentication',
      event_type: 'logout',
      event_name: 'user_logout',
      component: 'Đăng xuất',
      description: `Người dùng ${username} đã đăng xuất`,
      event_data: {
        username,
        logoutTime: new Date().toISOString(),
        sessionDuration: Math.round((Date.now() - this.pageStartTime) / 1000)
      }
    });
  }

  /**
   * Track custom event
   */
  trackEvent(eventName, data = {}) {
    this.logActivity({
      event_context: data.event_context || 'custom',
      event_type: data.event_type || 'custom',
      event_name: eventName,
      component: data.component || this.getCurrentComponent(),
      description: data.description || eventName,
      event_data: data
    });
  }

  /**
   * Helper: Get element info
   */
  getElementInfo(element) {
    const tagName = element.tagName?.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className ? `.${element.className.split(' ').join('.')}` : '';
    
    return {
      tagName,
      id: element.id,
      className: element.className,
      selector: `${tagName}${id}${classes}`,
      type: element.type,
      name: element.name,
      value: element.value
    };
  }

  /**
   * Helper: Get display name for element (text, aria-label, title, etc.)
   */
  getElementDisplayName(element) {
    if (!element) return null;

    // Ưu tiên aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
      return ariaLabel.trim();
    }

    // Ưu tiên title attribute
    if (element.title && element.title.trim()) {
      return element.title.trim();
    }

    // Cho INPUT/SELECT/TEXTAREA: Lấy label từ label element
    if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
      // Tìm label element qua for attribute hoặc parent
      const id = element.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label && label.textContent) {
          const labelText = label.textContent.trim();
          if (labelText && labelText.length < 100) {
            return labelText;
          }
        }
      }
      
      // Tìm label parent
      const labelParent = element.closest('label');
      if (labelParent && labelParent.textContent) {
        const labelText = labelParent.textContent.trim();
        if (labelText && labelText.length < 100) {
          return labelText;
        }
      }

      // Lấy placeholder cho input
      if (element.placeholder && element.placeholder.trim()) {
        return element.placeholder.trim();
      }

      // Lấy name attribute
      if (element.name && element.name.trim()) {
        return element.name.trim();
      }
    }

    // Cho BUTTON/A: Lấy text từ element hoặc child elements
    if (element.tagName === 'BUTTON' || element.tagName === 'A') {
      // Lấy innerText (tốt hơn cho các element có nested elements)
      const innerText = element.innerText?.trim();
      if (innerText && innerText.length > 0 && innerText.length < 100) {
        return innerText;
      }

      // Lấy text từ child span, i, hoặc text node đầu tiên
      const firstTextNode = Array.from(element.childNodes).find(node => 
        node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
      );
      if (firstTextNode && firstTextNode.textContent.trim().length < 100) {
        return firstTextNode.textContent.trim();
      }

      const firstSpan = element.querySelector('span, i, em, strong');
      if (firstSpan && firstSpan.textContent) {
        const spanText = firstSpan.textContent.trim();
        if (spanText && spanText.length < 100) {
          return spanText;
        }
      }

      // Lấy value cho button
      if (element.value && element.value.trim()) {
        return element.value.trim();
      }
    }

    // Lấy text content (loại bỏ whitespace)
    const textContent = element.textContent?.trim();
    if (textContent && textContent.length > 0 && textContent.length < 100) {
      return textContent;
    }

    // Lấy innerText (tốt hơn cho các element có nested elements)
    const innerText = element.innerText?.trim();
    if (innerText && innerText.length > 0 && innerText.length < 100) {
      return innerText;
    }

    // Lấy value cho input/button
    if (element.value && element.value.trim()) {
      return element.value.trim();
    }

    // Lấy alt cho image
    if (element.alt && element.alt.trim()) {
      return element.alt.trim();
    }

    // Nếu element không có text, thử lấy từ parent element gần nhất
    if (element.parentElement) {
      const parentText = element.parentElement.textContent?.trim();
      if (parentText && parentText.length > 0 && parentText.length < 100) {
        // Chỉ lấy nếu text khác với text của element (tránh duplicate)
        if (parentText !== textContent && parentText !== innerText) {
          return parentText;
        }
      }
    }

    // Thử lấy từ closest interactive parent (button, a, etc.)
    const interactiveParent = element.closest('button, a, [role="button"]');
    if (interactiveParent && interactiveParent !== element) {
      const parentText = interactiveParent.innerText?.trim();
      if (parentText && parentText.length > 0 && parentText.length < 100) {
        return parentText;
      }
    }

    return null;
  }

  /**
   * Helper: Get table name if element is inside a table
   */
  getTableName(element) {
    if (!element) return null;

    // Tìm table parent
    let current = element;
    let table = null;
    while (current && current !== document.body) {
      if (current.tagName === 'TABLE') {
        table = current;
        break;
      }
      current = current.parentElement;
    }

    if (!table) return null;

    // Lấy caption của table
    const caption = table.querySelector('caption');
    if (caption) {
      const captionText = caption.textContent?.trim();
      if (captionText) return captionText;
    }

    // Lấy text từ thead đầu tiên
    const thead = table.querySelector('thead');
    if (thead) {
      const firstRow = thead.querySelector('tr');
      if (firstRow) {
        const headerText = firstRow.textContent?.trim();
        if (headerText && headerText.length < 100) {
          return headerText;
        }
      }
    }

    // Lấy id hoặc class của table
    if (table.id) {
      return `Bảng ${table.id}`;
    }

    return 'Bảng';
  }

  /**
   * Helper: Get page name from document title or route
   */
  getPageName() {
    const path = window.location.pathname;
    
    // Mapping đầy đủ các routes
    const routeNames = {
      '/personal/dashboard': 'Trang chủ cá nhân',
      '/personal/documents': 'Tài liệu cá nhân',
      '/personal/tickets': 'Yêu cầu hỗ trợ',
      '/personal/notifications': 'Thông báo',
      '/personal/attendance': 'Điểm danh cá nhân',
      '/personal/profile': 'Hồ sơ cá nhân',
      '/personal/tasks': 'Nhiệm vụ',
      '/personal/requests': 'Yêu cầu',
      '/student/attendance': 'Điểm danh',
      '/student/exams': 'Thi cử',
      '/student/courses': 'Khóa học',
      '/student/grades': 'Điểm số',
      '/admin/dashboard': 'Trang quản trị',
      '/admin/sessions': 'Quản lý buổi học',
      '/admin/sessions/create': 'Tạo buổi học',
      '/admin/sessions/:id': 'Chi tiết buổi học',
      '/superadmin/systempage': 'Cài đặt hệ thống',
      '/superadmin/users': 'Quản lý người dùng',
      '/superadmin/dashboard': 'Trang quản trị cấp cao',
      '/ims/dashboard': 'Trang chủ IMS',
      '/login': 'Đăng nhập',
      '/register': 'Đăng ký',
      '/forgot-password': 'Quên mật khẩu',
      '/reset-password': 'Đặt lại mật khẩu',
      '/qr-login': 'Đăng nhập QR',
      '/status': 'Trang trạng thái'
    };

    // Kiểm tra exact match trước
    if (routeNames[path]) {
      return routeNames[path];
    }

    // Kiểm tra pattern match (cho dynamic routes)
    for (const [route, name] of Object.entries(routeNames)) {
      if (route.includes(':id') || route.includes('*')) {
        const routePattern = route.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*');
        const regex = new RegExp(`^${routePattern}$`);
        if (regex.test(path)) {
          return name;
        }
      }
    }

    // Thử lấy từ document.title (đã được set bởi usePageTitle hook)
    const title = document.title;
    if (title && title !== 'PCTU IMS') {
      // Loại bỏ "PCTU IMS" và progress indicator nếu có
      let pageName = title.replace(/\[.*?\]\s*/, '').replace(/\s*-\s*PCTU IMS.*$/, '').trim();
      if (pageName && pageName.length > 0) {
        return pageName;
      }
    }

    // Fallback: format từ path (không bao giờ trả về path raw)
    const segments = path.split('/').filter(Boolean);
    if (segments.length > 0) {
      const formatted = segments.map(s => {
        // Chuyển đổi snake_case và kebab-case thành Title Case
        return s
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }).join(' - ');
      
      return formatted || 'Trang chủ';
    }

    return 'Trang chủ';
  }

  /**
   * Helper: Check if element is interactive
   */
  isInteractiveElement(element) {
    const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
    return interactiveTags.includes(element.tagName) || 
           element.onclick !== null ||
           element.hasAttribute('data-hover-track');
  }

  /**
   * Helper: Get current component/page name
   */
  getCurrentComponent() {
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length === 0) return 'Home';
    
    return segments.map(s => 
      s.charAt(0).toUpperCase() + s.slice(1)
    ).join('/');
  }
}

// Singleton instance
const activityTracker = new ActivityTracker();

export default activityTracker;
