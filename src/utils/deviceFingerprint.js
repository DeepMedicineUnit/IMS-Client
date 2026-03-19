import FingerprintJS from '@fingerprintjs/fingerprintjs';

// Khởi tạo FingerprintJS
const fpPromise = FingerprintJS.load();

/**
 * Tạo địa chỉ MAC giả lập từ thông tin thiết bị
 * @returns {Promise<string>} Địa chỉ MAC giả lập (định dạng XX:XX:XX:XX:XX:XX)
 */
export const getDeviceFingerprint = async () => {
  try {
    // Lấy instance của FingerprintJS
    const fp = await fpPromise;
    
    // Lấy visitor identifier
    const result = await fp.get();
    
    // Tạo địa chỉ MAC giả lập từ visitor ID
    const macAddress = generateMACFromFingerprint(result.visitorId);
    
    return macAddress;
  } catch (error) {
    console.error('Error getting device fingerprint:', error);
    // Fallback: tạo MAC từ thông tin trình duyệt
    return generateMACFromBrowserInfo();
  }
};

/**
 * Tạo địa chỉ MAC từ fingerprint với tính ổn định cao
 * @param {string} fingerprint - Fingerprint từ FingerprintJS
 * @returns {string} Địa chỉ MAC (định dạng XX:XX:XX:XX:XX:XX)
 */
const generateMACFromFingerprint = (fingerprint) => {
  // Tạo hash từ toàn bộ fingerprint để giảm xác suất trùng lặp
  const fullHash = fingerprint;
  
  // Tạo hash đơn giản nhưng ổn định từ toàn bộ fingerprint
  let hash = 0;
  for (let i = 0; i < fullHash.length; i++) {
    const char = fullHash.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // Tạo thêm hash từ các thông tin thiết bị để tăng tính duy nhất
  const deviceInfo = [
    navigator.userAgent,
    navigator.platform,
    navigator.language,
    window.screen.width + 'x' + window.screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  ].join('|');
  
  let deviceHash = 0;
  for (let i = 0; i < deviceInfo.length; i++) {
    const char = deviceInfo.charCodeAt(i);
    deviceHash = ((deviceHash << 5) - deviceHash) + char;
    deviceHash = deviceHash & deviceHash;
  }
  
  // Kết hợp 2 hash để tạo MAC duy nhất hơn
  const combinedHash = Math.abs(hash ^ deviceHash).toString(16).padStart(12, '0').substring(0, 12);
  
  // Chuyển đổi thành địa chỉ MAC định dạng
  const macParts = [];
  for (let i = 0; i < 12; i += 2) {
    const hexPair = combinedHash.substring(i, i + 2);
    // Đảm bảo là ký tự hex hợp lệ
    const validHex = /^[0-9A-Fa-f]{2}$/.test(hexPair) ? hexPair : '00';
    macParts.push(validHex.toUpperCase());
  }
  
  return macParts.join(':');
};

/**
 * Tạo địa chỉ MAC từ thông tin trình duyệt (fallback)
 * @returns {string} Địa chỉ MAC (định dạng XX:XX:XX:XX:XX:XX)
 */
const generateMACFromBrowserInfo = () => {
  // Tạo hash từ thông tin trình duyệt
  const browserInfo = [
    navigator.userAgent,
    navigator.platform,
    navigator.language,
    window.screen.width + 'x' + window.screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  ].join('|');
  
  // Tạo hash đơn giản
  let hash = 0;
  for (let i = 0; i < browserInfo.length; i++) {
    const char = browserInfo.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Chuyển đổi thành hex và lấy 12 ký tự
  const hexString = Math.abs(hash).toString(16).padStart(12, '0').substring(0, 12);
  
  // Tạo địa chỉ MAC định dạng
  const macParts = [];
  for (let i = 0; i < 12; i += 2) {
    macParts.push(hexString.substring(i, i + 2).toUpperCase());
  }
  
  return macParts.join(':');
};

/**
 * Lấy thông tin chi tiết về thiết bị
 * @returns {Promise<Object>} Thông tin chi tiết về thiết bị
 */
export const getDeviceDetails = async () => {
  try {
    // Lấy instance của FingerprintJS
    const fp = await fpPromise;
    
    // Lấy visitor result với thông tin chi tiết
    const result = await fp.get();
    
    // Tạo địa chỉ MAC giả lập
    const macAddress = generateMACFromFingerprint(result.visitorId);
    
    // Trả về thông tin chi tiết
    return {
      macAddress: macAddress,
      fingerprint: result.visitorId,
      components: result.components,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting device details:', error);
    // Fallback với thông tin cơ bản
    return {
      macAddress: generateMACFromBrowserInfo(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: new Date().toISOString()
    };
  }
};
