const WebpackObfuscator = require('webpack-obfuscator');
const path = require('path');
const webpack = require('webpack');

module.exports = function override(config, env) {
  // Polyfill Node core modules cho @webex/widgets (webpack 5 không còn polyfill mặc định)
  if (!config.resolve) config.resolve = {};
  config.resolve.fallback = {
    ...config.resolve.fallback,
    os: require.resolve('os-browserify/browser'),
    url: require.resolve('url/'),
    querystring: require.resolve('querystring-es3'),
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    fs: path.resolve(__dirname, 'empty-fs.js'), // Node fs không có trong browser
    process: require.resolve('process/browser.js'),
  };

  // Cung cấp global process cho các dependency (process is not defined trong browser)
  // Dùng .js để thỏa fullySpecified (ESM) khi resolve từ axios và các package khác
  if (!config.plugins) config.plugins = [];
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
    })
  );

  // Xử lý entry point tùy chỉnh cho status page
  const customEntry = process.env.REACT_APP_ENTRY;
  if (customEntry) {
    const entryPath = path.resolve(__dirname, 'src', customEntry);
    // Create React App sử dụng entry là object với key 'main'
    if (typeof config.entry === 'object' && !Array.isArray(config.entry)) {
      config.entry.main = entryPath;
    } else {
      config.entry = entryPath;
    }
    console.log(`[config-overrides] Using custom entry: ${entryPath}`);
  }

  // Chỉ obfuscate trong production build
  if (env === 'production') {
    // Tắt source maps để ẩn code gốc hoàn toàn
    config.devtool = false;
    
    // Đảm bảo plugins array tồn tại
    if (!config.plugins) {
      config.plugins = [];
    }
    
    // FIX: Tắt obfuscator tạm thời để tránh lỗi "new.target expression is not allowed here"
    // Có thể bật lại sau khi fix các vấn đề tương thích
    const ENABLE_OBFUSCATION = process.env.ENABLE_OBFUSCATION === 'true';
    
    if (ENABLE_OBFUSCATION) {
      // Thêm webpack-obfuscator vào plugins với cấu hình an toàn hơn
      config.plugins.push(
        new WebpackObfuscator({
          // === String Obfuscation ===
          rotateStringArray: true,
          stringArray: true,
          stringArrayCallsTransform: false, // Tắt để tránh lỗi
          stringArrayEncoding: ['base64'],
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayWrappersCount: 1, // Giảm xuống 1
          stringArrayWrappersChainedCalls: false, // Tắt để tránh lỗi
          stringArrayWrappersParametersMaxCount: 2, // Giảm xuống
          stringArrayWrappersType: 'function',
          stringArrayThreshold: 0.5, // Giảm xuống 50%
          
          // === Identifier Names ===
          identifierNamesGenerator: 'hexadecimal',
          renameGlobals: false,
          
          // === Code Protection ===
          selfDefending: false, // Tắt hoàn toàn để tránh lỗi new.target
          compact: true,
          
          // === Control Flow Obfuscation ===
          controlFlowFlattening: false, // Tắt để tránh lỗi
          controlFlowFlatteningThreshold: 0,
          
          // === Dead Code Injection ===
          deadCodeInjection: false, // Tắt để tránh lỗi
          deadCodeInjectionThreshold: 0,
          
          // === Debug Protection ===
          debugProtection: false,
          debugProtectionInterval: 0,
          
          // === Console ===
          disableConsoleOutput: false,
          
          // === Domain Lock ===
          domainLock: [],
          
          // === Other Options ===
          log: false,
          numbersToExpressions: false, // Tắt để tránh lỗi với new.target
          simplify: true,
          splitStrings: false, // Tắt để tránh lỗi
          transformObjectKeys: false,
          unicodeEscapeSequence: false
        }, [
          // Loại trừ các file không cần obfuscate
          '**/node_modules/**',
          '**/vendor/**',
          '**/*.map'
        ])
      );
    }
  }
  
  return config;
};
