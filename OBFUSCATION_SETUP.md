# Hướng dẫn thiết lập Code Obfuscation

## Mục đích
Mã hóa (obfuscate) code JavaScript khi build production để:
- **Ẩn tên file và function gốc**: `handleSubmitAttendance` → `_0x1a2b`
- **Bảo vệ logic code** khỏi việc đọc trộm
- **Giảm kích thước file** (minification)
- **Mã hóa string**: Tất cả text sẽ được mã hóa base64

## Đã cài đặt

Các package đã được cài đặt:
- `react-app-rewired`: Để override webpack config của Create React App
- `webpack-obfuscator`: Plugin để obfuscate code

## Cách sử dụng

### Build production với obfuscation

```bash
cd client
npm run build
```

Code sau khi build sẽ được:
1. **Minified**: Loại bỏ khoảng trắng, xuống dòng
2. **Mangled**: Đổi tên biến/function thành hex (0x1a2b, 0x2c3d...)
3. **Obfuscated**: 
   - String được mã hóa base64
   - Control flow bị làm rối
   - Thêm dead code để gây nhiễu
   - Object keys được mã hóa

### Kết quả

Khi mở F12, bạn sẽ thấy:
- ❌ **Trước**: `StudentExams.js`, `handleSubmitAttendance()`, `setError()`
- ✅ **Sau**: `main.7e8f2a.js`, `_0x1a2b()`, `_0x2c3d()`

## Cách hoạt động

### 1. Minification
Code gốc:
```javascript
function handleSubmitAttendance() {
  setError('Lỗi');
}
```

Sau minification:
```javascript
function a(){b('Lỗi')}
```

### 2. Obfuscation
Sau obfuscation:
```javascript
var _0x1a2b=['Lỗi'];(function(_0x3c4d,_0x5e6f){var _0x7g8h=function(_0x9i0j){while(--_0x9i0j){_0x3c4d['push'](_0x3c4d['shift']());}};_0x7g8h(++_0x5e6f);}(_0x1a2b,0x123));function _0x2c3d(){_0x4e5f(_0x1a2b[0x0]);}
```

## Tùy chỉnh mức độ obfuscation

Chỉnh sửa file `config-overrides.js`:

```javascript
// Mức độ làm rối control flow (0-1)
controlFlowFlatteningThreshold: 0.75, // Càng cao càng rối

// Mức độ thêm dead code (0-1)
deadCodeInjectionThreshold: 0.4, // Càng cao càng nhiều code rác

// Tỷ lệ string bị mã hóa (0-1)
stringArrayThreshold: 0.75, // Càng cao càng nhiều string bị mã hóa
```

## Lưu ý quan trọng

1. **Chỉ obfuscate khi build production** - Development mode không bị ảnh hưởng
2. **Source maps bị tắt** - Không thể debug code gốc trong production
3. **Build sẽ chậm hơn** - Quá trình obfuscation mất nhiều thời gian
4. **File size có thể tăng** - Do thêm dead code và wrapper functions
5. **Một số tính năng có thể cần điều chỉnh** - Nếu gặp lỗi, giảm mức độ obfuscation

## Troubleshooting

### Nếu build bị lỗi:
1. Giảm `controlFlowFlatteningThreshold` xuống 0.5
2. Giảm `deadCodeInjectionThreshold` xuống 0.2
3. Tắt `selfDefending` nếu gặp lỗi runtime

### Nếu code không chạy sau obfuscation:
1. Kiểm tra `renameGlobals` phải là `false`
2. Đảm bảo không obfuscate các file từ node_modules
3. Thử tắt `transformObjectKeys` nếu có lỗi với object

## So sánh

| Tính năng | Không obfuscate | Có obfuscate |
|-----------|----------------|--------------|
| Tên function | `handleSubmitAttendance` | `_0x1a2b3c4` |
| String | `"Lỗi khi bắt đầu"` | `_0x1a2b[0x0]` (base64) |
| Control flow | Dễ đọc | Rất khó đọc |
| File size | Nhỏ hơn | Lớn hơn ~20-30% |
| Build time | Nhanh | Chậm hơn ~2-3x |
| Bảo mật | Thấp | Cao |
