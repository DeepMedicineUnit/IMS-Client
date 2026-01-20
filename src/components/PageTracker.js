import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../utils/analytics';

const PageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page view when location changes
    const pageName = location.pathname;
    const pageTitle = document.title;
    
    trackPageView(pageName, pageTitle);
  }, [location]);

  return null; // This component doesn't render anything
};

export default PageTracker;
