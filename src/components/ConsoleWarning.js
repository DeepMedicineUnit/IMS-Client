import React, { useEffect, useRef } from 'react';
import i18n from '../i18n/config';

const ConsoleWarning = () => {
  const hasWarnedRef = useRef(false);
  const warningShownRef = useRef(false);

  // Kiểm tra xem có phải localhost không
  const isLocalhost = () => {
    const hostname = window.location.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local')
    );
  };

  // Hiển thị cảnh báo trong Console
  const showConsoleWarning = () => {
    if (warningShownRef.current) {
      return; // Đã hiển thị rồi, không hiển thị lại
    }

    // Lấy translations từ i18n
    const title = i18n.t('consoleWarning.title');
    const message = i18n.t('consoleWarning.message');
    const footer = i18n.t('consoleWarning.footer');

    // Tạo cảnh báo với styling đặc biệt
    const separator = '═'.repeat(70);
    
    // Hiển thị separator trên
    console.log('%c' + separator, 'color: #ff0000; font-weight: bold; font-size: 14px;');
    
    // Tiêu đề cảnh báo
    console.log(
      `%c⚠️ ${title} ⚠️`,
      'font-size: 28px; font-weight: bold; color: #ff0000; text-shadow: 2px 2px 4px rgb(255, 255, 255); padding: 15px; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); border-radius: 10px; display: block; margin: 10px 0;'
    );
    
    // Nội dung cảnh báo
    console.log(
      `%c${message}`,
      'font-size: 16px; line-height: 1.8; color: #333; padding: 15px; background: #fff3cd; border-left: 5px solid #ffc107; margin: 10px 0; border-radius: 5px;'
    );
    
    // Footer cảnh báo
    console.log(
      `%c⚠️ ${footer}`,
      'font-size: 14px; color: #856404; font-weight: bold; padding: 10px; background: #ffeaa7; border-radius: 5px; margin: 10px 0;'
    );
    
    // Hiển thị separator dưới
    console.log('%c' + separator, 'color: #ff0000; font-weight: bold; font-size: 14px;');
    
    warningShownRef.current = true;
  };

  useEffect(() => {
    // Chỉ chạy trên production (không phải localhost)
    if (isLocalhost()) {
      return;
    }

    let devtools = {
      open: false,
      orientation: null
    };

    const threshold = 160;

    // Phương pháp 1: Phát hiện dựa trên kích thước màn hình
    const detectDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      const orientation = widthThreshold ? 'vertical' : 'horizontal';

      if (
        !(heightThreshold && widthThreshold) &&
        ((window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) || widthThreshold || heightThreshold)
      ) {
        if (!devtools.open || devtools.orientation !== orientation) {
          devtools.open = true;
          devtools.orientation = orientation;
          if (!hasWarnedRef.current) {
            showConsoleWarning();
            hasWarnedRef.current = true;
          }
        }
      } else {
        if (devtools.open) {
          devtools.open = false;
          devtools.orientation = null;
        }
      }
    };

    // Phương pháp 2: Phát hiện dựa trên console
    const element = new Image();
    let devtoolsOpened = false;

    Object.defineProperty(element, 'id', {
      get: function() {
        if (!devtoolsOpened && !hasWarnedRef.current) {
          devtoolsOpened = true;
          showConsoleWarning();
          hasWarnedRef.current = true;
        }
      }
    });

    // Phương pháp 3: Sử dụng debugger statement với timing
    let checkInterval;
    const startCheck = () => {
      let start = performance.now();
      debugger; // eslint-disable-line no-debugger
      let end = performance.now();
      
      if (end - start > 100 && !hasWarnedRef.current) {
        showConsoleWarning();
        hasWarnedRef.current = true;
      }
    };

    // Chạy kiểm tra định kỳ
    checkInterval = setInterval(() => {
      detectDevTools();
      startCheck();
      // Log một object đặc biệt để trigger getter (chỉ khi chưa hiển thị cảnh báo)
      if (!hasWarnedRef.current) {
        console.log(element);
      }
    }, 1000);

    // Kiểm tra ban đầu
    detectDevTools();

    // Cleanup
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, []);

  // Component này không render gì cả, chỉ hiển thị trong Console
  return null;
};

export default ConsoleWarning;
