/**
 * Attendance Data Cache Management
 * Manages caching and incremental loading of attendance data
 */

const CACHE_KEYS = {
  ATTENDANCE_DATA: 'attendance_cache_data',
  LAST_SYNC: 'attendance_cache_last_sync',
  METADATA: 'attendance_cache_metadata'
};

const CACHE_VERSION = '1.0';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Check if cache is valid and not expired
 */
export const isCacheValid = () => {
  try {
    const lastSync = localStorage.getItem(CACHE_KEYS.LAST_SYNC);
    const metadata = JSON.parse(localStorage.getItem(CACHE_KEYS.METADATA) || '{}');
    
    if (!lastSync || metadata.version !== CACHE_VERSION) {
      return false;
    }
    
    const lastSyncTime = new Date(lastSync).getTime();
    const now = Date.now();
    const cacheAge = now - lastSyncTime;
    
    return cacheAge < CACHE_TTL;
  } catch (error) {
    console.error('Error checking cache validity:', error);
    return false;
  }
};

/**
 * Get cached attendance data
 */
export const getCachedData = () => {
  try {
    const cachedData = localStorage.getItem(CACHE_KEYS.ATTENDANCE_DATA);
    if (!cachedData) {
      return null;
    }
    
    return JSON.parse(cachedData);
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
};

/**
 * Get last sync timestamp
 */
export const getLastSyncTime = () => {
  try {
    const lastSync = localStorage.getItem(CACHE_KEYS.LAST_SYNC);
    return lastSync || null;
  } catch (error) {
    console.error('Error getting last sync time:', error);
    return null;
  }
};

/**
 * Save data to cache
 */
export const saveCacheData = (data, isFullSync = false) => {
  try {
    const now = new Date().toISOString();
    
    // If it's an incremental update, merge with existing data
    let dataToSave = data;
    
    if (!isFullSync) {
      const existingData = getCachedData();
      if (existingData && Array.isArray(existingData)) {
        // Merge new data with existing data
        // Remove duplicates based on ID
        const existingIds = new Set(existingData.map(item => item.id || `${item.session_id}_${item.student_id}`));
        const newItems = data.filter(item => {
          const itemId = item.id || `${item.session_id}_${item.student_id}`;
          return !existingIds.has(itemId);
        });
        
        dataToSave = [...existingData, ...newItems];
      }
    }
    
    // Save data
    localStorage.setItem(CACHE_KEYS.ATTENDANCE_DATA, JSON.stringify(dataToSave));
    localStorage.setItem(CACHE_KEYS.LAST_SYNC, now);
    localStorage.setItem(CACHE_KEYS.METADATA, JSON.stringify({
      version: CACHE_VERSION,
      lastSync: now,
      recordCount: dataToSave.length,
      isFullSync
    }));
    
    return true;
  } catch (error) {
    console.error('Error saving cache:', error);
    
    // If quota exceeded, clear cache and try again
    if (error.name === 'QuotaExceededError') {
      clearCache();
      console.warn('Cache quota exceeded, cleared cache');
    }
    
    return false;
  }
};

/**
 * Clear cache
 */
export const clearCache = () => {
  try {
    localStorage.removeItem(CACHE_KEYS.ATTENDANCE_DATA);
    localStorage.removeItem(CACHE_KEYS.LAST_SYNC);
    localStorage.removeItem(CACHE_KEYS.METADATA);
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
};

/**
 * Get cache metadata
 */
export const getCacheMetadata = () => {
  try {
    const metadata = localStorage.getItem(CACHE_KEYS.METADATA);
    return metadata ? JSON.parse(metadata) : null;
  } catch (error) {
    console.error('Error getting cache metadata:', error);
    return null;
  }
};

/**
 * Get cache size in MB
 */
export const getCacheSize = () => {
  try {
    const data = localStorage.getItem(CACHE_KEYS.ATTENDANCE_DATA) || '';
    const sizeInBytes = new Blob([data]).size;
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
    return sizeInMB;
  } catch (error) {
    console.error('Error calculating cache size:', error);
    return '0';
  }
};

/**
 * Force refresh cache
 */
export const forceRefreshCache = () => {
  clearCache();
  return { shouldFetch: true, isIncremental: false };
};

/**
 * Check if should fetch data
 * Returns object with shouldFetch and isIncremental flags
 */
export const shouldFetchData = () => {
  const isValid = isCacheValid();
  const cachedData = getCachedData();
  
  if (!cachedData || cachedData.length === 0) {
    // No cache - full sync needed
    console.log('💾 Cache: empty, need full sync');
    return { shouldFetch: true, isIncremental: false };
  }
  
  if (!isValid) {
    // Cache expired - incremental update
    console.log('⏰ Cache: expired, need incremental update');
    return { shouldFetch: true, isIncremental: true };
  }
  
  // Cache valid - use cached data, but can do background refresh
  console.log('✅ Cache: valid, using cached data');
  return { shouldFetch: false, isIncremental: false };
};

/**
 * Merge incremental data with cached data
 */
export const mergeIncrementalData = (cachedData, newData) => {
  if (!Array.isArray(cachedData) || !Array.isArray(newData)) {
    return newData || cachedData || [];
  }
  
  // Create a map of existing records by unique identifier
  const dataMap = new Map();
  
  // Add cached data to map
  cachedData.forEach(item => {
    const key = item.id || `${item.session_id}_${item.student_id}_${item.timestamp}`;
    dataMap.set(key, item);
  });
  
  // Add/update with new data
  newData.forEach(item => {
    const key = item.id || `${item.session_id}_${item.student_id}_${item.timestamp}`;
    dataMap.set(key, item);
  });
  
  // Convert back to array
  return Array.from(dataMap.values());
};

export default {
  isCacheValid,
  getCachedData,
  getLastSyncTime,
  saveCacheData,
  clearCache,
  getCacheMetadata,
  getCacheSize,
  forceRefreshCache,
  shouldFetchData,
  mergeIncrementalData
};







