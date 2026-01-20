const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy to API Gateway (port 5000)
  // API Gateway will route requests to appropriate modules
  // In Docker, use service name 'gateway', otherwise use localhost
  
  // Priority 1: Use REACT_APP_API_URL if explicitly set (Docker sets this to http://gateway:5000)
  // Priority 2: If REACT_APP_API_URL contains 'gateway', we're in Docker - use it
  // Priority 3: Use localhost for local development
  let apiTarget;
  
  if (process.env.REACT_APP_API_URL) {
    // Use the explicitly set API URL (Docker sets this to http://gateway:5000)
    apiTarget = process.env.REACT_APP_API_URL;
    console.log(`[Client Proxy] Using REACT_APP_API_URL: ${apiTarget}`);
  } else if (process.env.NODE_ENV === 'production') {
    // In production, assume Docker environment
    apiTarget = 'http://gateway:5000';
    console.log(`[Client Proxy] Using production target: ${apiTarget}`);
  } else {
    // Local development
    apiTarget = 'http://localhost:5000';
    console.log(`[Client Proxy] Using localhost target: ${apiTarget}`);
  }
  
  // Proxy configuration for API requests
  const proxyConfig = {
    target: apiTarget,
    changeOrigin: true,
    secure: false,
    logLevel: 'warn',
    timeout: 30000, // 30 seconds timeout
    proxyTimeout: 30000,
    xfwd: true, // Add X-Forwarded-* headers
    ws: false, // Disable WebSocket
    followRedirects: true,
    onProxyReq: (proxyReq, req, res) => {
      // Forward authentication headers
      if (req.headers['x-auth-token']) {
        proxyReq.setHeader('x-auth-token', req.headers['x-auth-token']);
      }
      if (req.headers['authorization']) {
        proxyReq.setHeader('authorization', req.headers['authorization']);
      }
    },
    onError: (err, req, res) => {
      const timestamp = new Date().toISOString();
      console.error(`[Client Proxy] [${timestamp}] ❌ Proxy error for ${req.method} ${req.url}`);
      console.error(`[Client Proxy] Error code: ${err.code || 'UNKNOWN'}`);
      console.error(`[Client Proxy] Error message: ${err.message || 'No message'}`);
      console.error(`[Client Proxy] Error stack:`, err.stack);
      
      if (!res.headersSent) {
        let errorMessage = 'Không thể kết nối đến API Gateway. Vui lòng thử lại sau.';
        
        if (err.code === 'ECONNREFUSED') {
          errorMessage = 'API Gateway không đang chạy. Vui lòng khởi động server.';
        } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
          errorMessage = 'API Gateway không phản hồi. Vui lòng kiểm tra kết nối.';
        }
        
        res.status(503).json({
          success: false,
          message: errorMessage,
          errorCode: err.code || 'UNKNOWN',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      if (process.env.NODE_ENV === 'development') {
        const timestamp = new Date().toISOString();
        console.log(`[Client Proxy] [${timestamp}] ✅ Response from Gateway (${req.url}): ${proxyRes.statusCode}`);
      }
    }
  };

  // Proxy API requests
  app.use('/api', createProxyMiddleware(proxyConfig));
  
  // Proxy uploads requests (avatars, documents, etc.)
  app.use('/uploads', createProxyMiddleware(proxyConfig));
};
