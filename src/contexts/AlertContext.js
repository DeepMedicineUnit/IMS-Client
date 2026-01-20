import React, { createContext, useContext, useState, useCallback } from 'react';
import AlertToast from '../components/AlertToast';

const AlertContext = createContext();

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
};

export const AlertProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);

  const showAlert = useCallback((message, variant = 'info', title = null, duration = 5000) => {
    const id = Date.now() + Math.random();
    const newAlert = {
      id,
      variant,
      title,
      message,
      duration
    };

    setAlerts(prev => [...prev, newAlert]);
    return id;
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setAlerts([]);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, removeAlert, clearAll }}>
      {children}
      <div className="alert-toast-container">
        {alerts.map(alert => (
          <AlertToast
            key={alert.id}
            id={alert.id}
            variant={alert.variant}
            title={alert.title}
            message={alert.message}
            duration={alert.duration}
            onClose={removeAlert}
          />
        ))}
      </div>
    </AlertContext.Provider>
  );
};



