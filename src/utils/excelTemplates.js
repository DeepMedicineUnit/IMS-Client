import * as XLSX from 'xlsx';

/**
 * Creates a student import template Excel file and triggers download
 */
// Hàm để tạo tên cột Excel từ số cột (0-based)
// Ví dụ: 0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA, 27 -> AB, ...
const getExcelColName = (n) => {
  let colName = '';
  while (n >= 0) {
    colName = String.fromCharCode(65 + (n % 26)) + colName;
    n = Math.floor(n / 26) - 1;
  }
  return colName;
};

// Tạo danh sách tên cột Excel từ A đến AZ để debug
const generateExcelColumnNames = () => {
  const columns = [];
  for (let i = 0; i < 52; i++) {
    columns.push(getExcelColName(i));
  }
  console.log('Excel column names:', columns);
  console.log('Column AV index:', columns.indexOf('AV'));
  return columns;
};

export const createStudentImportTemplate = () => {
  // Debug: In ra tên các cột Excel
  const excelColumns = generateExcelColumnNames();
  // Định nghĩa tất cả các cột theo yêu cầu
  const headers = [
    'Mã Phường/Xã', 'Mã Quận/Huyện', 'Mã Tỉnh/TP', 'Mã khối', 'Mã SV', 'Mã lớp', 
    'Họ lót', 'Tên', 'Tên đầy đủ VB', 'Ngày sinh', 'Phái', 'Nơi sinh', 'Mã ngân hàng', 
    'Tên ngân hàng', 'Số tài khoản', 'Chi nhánh ngân hàng', 'Mã khoa', 'Tên khoa', 
    'Mã ngành', 'Tên ngành', 'Mã bậc hệ', 'Tên bậc hệ', 'NHHK vào', 'NHHK ra', 
    'Niên khóa', 'Trạng thái', 'Địa chỉ hộ khẩu', 'Tên dân tộc', 'Tên tôn giáo', 
    'Tên Tỉnh/TP', 'Tên Quận/Huyện', 'Số CMND', 'Ngày cấp', 'Tên Phường/Xã', 
    'Nơi cấp CMND', 'Số năm bđ', 'Số năm TNXP', 'Tên cha', 'Nsinh cha', 'Số ĐT cha', 
    'Tên mẹ', 'Ngày sinh mẹ', 'Số ĐT mẹ', 'Số anh chị em', 'Địa chỉ liên lạc', 
    'Người liên lạc', 'Tel hộ khẩu', 'Điện thoại', 'Địa chỉ thường trú', 'Tên chủ hộ', 
    'Tel thường trú', 'Phòng ktx', 'Loại cư trú', 'Tp gđ', 'Khu vực', 'Đối tượng TS', 
    'Số báo danh', 'Điểm 1', 'Điểm 3', 'Điểm 2', 'Năm tốt nghiệp PTTH', 'Điểm tổng', 
    'Khối thi', 'Ngành thi', 'Email liên lạc', 'Email 2', 'Loại tổ chức', 'VB hệ đào tạo', 
    'Số văn bằng', 'Điểm TBTN ngoài', 'Quốc tịch', 'Ngày nhập học', 'Tên trường THPT 12', 
    'Tỉnh trường THPT 12', 'Điểm TB Lớp 10', 'Điểm TB Lớp 11', 'Điểm TB Lớp 12', 
    'Thi KTNL', 'Mã còng', 'ID SV text', 'password', 'Tình trạng', 
    'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ',
    'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT',
    'AU', 'AV-Số điện thoại'
  ];

  // Tạo dòng dữ liệu mẫu
  const sampleData = [
    '', '', '', '', 'SV001', 'CNTT01', 
    'Nguyễn Văn', 'A', 'Nguyễn Văn A', '01/01/2000', 'Nam', 'Hà Nội', '', 
    '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', '', '', 
    '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', 'student1@example.com', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', 'SV001', 'Pctu@123', 'Đang học',
    '', '', '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '', '', '',
    '', '0987654321'
  ];

  const sampleData2 = [
    '', '', '', '', 'SV002', 'CNTT01', 
    'Trần Thị', 'B', 'Trần Thị B', '02/02/2000', 'Nữ', 'TP.HCM', '', 
    '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', '', '', 
    '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', 'student2@example.com', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', 'SV002', 'Pctu@123', 'Nghỉ học',
    '', '', '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '', '', '',
    '', '0912345678'
  ];
  
  const sampleData3 = [
    '', '', '', '', 'SV003', 'CNTT02', 
    'Lê Văn', 'C', 'Lê Văn C', '03/03/2000', 'Nam', 'Đà Nẵng', '', 
    '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', '', '', 
    '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', '', '', '', 
    '', '', 'student3@example.com', '', '', '', 
    '', '', '', '', '', '', 
    '', '', '', 'SV003', 'Pctu@123', 'Đã tốt nghiệp',
    '', '', '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '', '', '',
    '', '0909123456'
  ];

  // Tạo worksheet với headers và dữ liệu mẫu
  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    sampleData,
    sampleData2,
    sampleData3
  ]);

  // Thiết lập độ rộng cột
  const wscols = headers.map(() => ({ wch: 15 }));
  
  // Điều chỉnh độ rộng cho một số cột cụ thể
  wscols[4] = { wch: 15 };  // Mã SV
  wscols[8] = { wch: 25 };  // Tên đầy đủ VB
  wscols[63] = { wch: 25 }; // Email liên lạc
  wscols[74] = { wch: 15 }; // password
  wscols[75] = { wch: 15 }; // Tình trạng
  wscols[96] = { wch: 15 }; // Số điện thoại

  ws['!cols'] = wscols;

  // Tạo workbook và thêm worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'SinhVien');

  // Tạo file Excel và tải xuống
  XLSX.writeFile(wb, 'mau_nhap_sinh_vien.xlsx');
};

export default {
  createStudentImportTemplate
};
