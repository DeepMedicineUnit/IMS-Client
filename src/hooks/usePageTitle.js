import { useEffect } from 'react';

/**
 * Custom hook to set page title with optional progress indicator
 * @param {string} title - The title to set for the page
 * @param {number} progress - Optional progress percentage (0-100) to display in title
 */
export const usePageTitle = (title, progress = null) => {
  useEffect(() => {
    const baseTitle = 'PCTU IMS';
    let fullTitle = title ? `${title} - ${baseTitle}` : baseTitle;
    
    // Add progress indicator if provided and >= 0 (including 100% which may still be processing)
    if (progress !== null && progress >= 0) {
      fullTitle = `[${Math.round(progress)}%] ${fullTitle}`;
    }
    
    document.title = fullTitle;
    
    // Cleanup: restore default title when component unmounts
    return () => {
      document.title = baseTitle;
    };
  }, [title, progress]);
};

export default usePageTitle;



