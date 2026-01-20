import React, { useState, useEffect } from 'react';
import './AlertToast.css';

const AlertToast = ({ id, variant, title, message, onClose, duration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    // Trigger animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto close
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsRemoving(true);
    setTimeout(() => {
      onClose(id);
    }, 300); // Match animation duration
  };

  const getVariantConfig = () => {
    const configs = {
      success: {
        bgColor: 'bg-emerald-500',
        textColor: 'text-emerald-500',
        icon: (
          <path d="M20 3.33331C10.8 3.33331 3.33337 10.8 3.33337 20C3.33337 29.2 10.8 36.6666 20 36.6666C29.2 36.6666 36.6667 29.2 36.6667 20C36.6667 10.8 29.2 3.33331 20 3.33331ZM16.6667 28.3333L8.33337 20L10.6834 17.65L16.6667 23.6166L29.3167 10.9666L31.6667 13.3333L16.6667 28.3333Z" />
        ),
        defaultTitle: 'Success'
      },
      info: {
        bgColor: 'bg-blue-500',
        textColor: 'text-blue-500',
        icon: (
          <path d="M20 3.33331C10.8 3.33331 3.33337 10.8 3.33337 20C3.33337 29.2 10.8 36.6666 20 36.6666C29.2 36.6666 36.6667 29.2 36.6667 20C36.6667 10.8 29.2 3.33331 20 3.33331ZM21.6667 28.3333H18.3334V25H21.6667V28.3333ZM21.6667 21.6666H18.3334V11.6666H21.6667V21.6666Z" />
        ),
        defaultTitle: 'Info'
      },
      warning: {
        bgColor: 'bg-yellow-400',
        textColor: 'text-yellow-400',
        icon: (
          <path d="M20 3.33331C10.8 3.33331 3.33337 10.8 3.33337 20C3.33337 29.2 10.8 36.6666 20 36.6666C29.2 36.6666 36.6667 29.2 36.6667 20C36.6667 10.8 29.2 3.33331 20 3.33331ZM21.6667 28.3333H18.3334V25H21.6667V28.3333ZM21.6667 21.6666H18.3334V11.6666H21.6667V21.6666Z" />
        ),
        defaultTitle: 'Warning'
      },
      danger: {
        bgColor: 'bg-red-500',
        textColor: 'text-red-500',
        icon: (
          <path d="M20 3.36667C10.8167 3.36667 3.3667 10.8167 3.3667 20C3.3667 29.1833 10.8167 36.6333 20 36.6333C29.1834 36.6333 36.6334 29.1833 36.6334 20C36.6334 10.8167 29.1834 3.36667 20 3.36667ZM19.1334 33.3333V22.9H13.3334L21.6667 6.66667V17.1H27.25L19.1334 33.3333Z" />
        ),
        defaultTitle: 'Error'
      }
    };

    return configs[variant] || configs.info;
  };

  const config = getVariantConfig();
  const displayTitle = title || config.defaultTitle;

  return (
    <div
      className={`alert-toast ${isVisible && !isRemoving ? 'alert-toast-visible' : 'alert-toast-hidden'}`}
      style={{
        animation: isRemoving ? 'slideOutRight 0.3s ease-out forwards' : undefined
      }}
    >
      <div style={{ display: 'flex', width: '100%', maxWidth: '400px', overflow: 'hidden', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', backgroundColor: config.bgColor === 'bg-emerald-500' ? '#10b981' : config.bgColor === 'bg-blue-500' ? '#3b82f6' : config.bgColor === 'bg-yellow-400' ? '#facc15' : '#ef4444' }}>
          <svg style={{ width: '24px', height: '24px', color: 'white', fill: 'currentColor' }} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            {config.icon}
          </svg>
        </div>
        <div style={{ padding: '8px 16px', marginLeft: '-12px', flex: 1 }}>
          <div style={{ marginLeft: '12px' }}>
            <div className="d-flex justify-content-between align-items-start">
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: config.textColor === 'text-emerald-500' ? '#10b981' : config.textColor === 'text-blue-500' ? '#3b82f6' : config.textColor === 'text-yellow-400' ? '#facc15' : '#ef4444' }}>{displayTitle}</span>
                <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: 0 }}>{message}</p>
              </div>
              <button
                type="button"
                className="btn-close-alert ms-2"
                onClick={handleClose}
                aria-label="Close"
              >
                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertToast;

