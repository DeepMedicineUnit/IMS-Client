const { spawn } = require('child_process');

console.log('🚀 Starting Status Page on port 3001...\n');
console.log('📝 index.js sẽ tự động phát hiện port 3001 và render StatusPage\n');

// Set PORT=3001 và chạy react-scripts start
// index.js sẽ tự động phát hiện port và render component phù hợp
const reactScripts = spawn('npm', ['run', 'start'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: '3001' }
});

// Xử lý khi process dừng
reactScripts.on('close', (code) => {
    console.log('\n🛑 Status page stopped.');
    process.exit(code);
});

// Xử lý lỗi
reactScripts.on('error', (err) => {
    console.error('❌ Error starting status page:', err);
    process.exit(1);
});

// Xử lý khi user dừng (Ctrl+C)
process.on('SIGINT', () => {
    console.log('\n\n⚠️  Stopping status page...');
    reactScripts.kill();
    process.exit(0);
});

process.on('SIGTERM', () => {
    reactScripts.kill();
    process.exit(0);
});




