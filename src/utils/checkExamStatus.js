/**
 * Script kiểm tra trạng thái kỳ thi từ phía client (Browser Console)
 * 
 * Cách sử dụng:
 * 1. Mở Browser Console (F12)
 * 2. Copy và paste toàn bộ code này vào console
 * 3. Chạy: checkExamStatus('Bài tập thực hành - Hệ điều hành')
 * 
 * Hoặc import vào component và gọi:
 * import checkExamStatus from './utils/checkExamStatus';
 * checkExamStatus('Bài tập thực hành - Hệ điều hành');
 */

import api from './api';

export default async function checkExamStatus(examTitle = 'Bài tập thực hành - Hệ điều hành') {
  try {
    console.log('='.repeat(80));
    console.log(`🔍 KIỂM TRA KỲ THI: "${examTitle}"`);
    console.log('='.repeat(80));

    // 1. Lấy danh sách tất cả kỳ thi (cần quyền admin)
    console.log('\n📋 Bước 1: Lấy danh sách kỳ thi...');
    let allExams = [];
    try {
      const response = await api.get('/lms/exams');
      if (response.data?.success && response.data?.data) {
        allExams = Array.isArray(response.data.data.exams) 
          ? response.data.data.exams 
          : (Array.isArray(response.data.data) ? response.data.data : []);
      }
    } catch (error) {
      console.log('   ⚠️  Không thể lấy danh sách kỳ thi (cần quyền admin):', error.message);
    }

    // Tìm kỳ thi
    const exam = allExams.find(e => e.exam_title === examTitle);
    
    if (!exam) {
      console.log('   ❌ KHÔNG TÌM THẤY KỲ THI!');
      console.log('   💡 Thử tìm kiếm theo từ khóa...');
      const partialMatch = allExams.find(e => 
        e.exam_title && e.exam_title.includes(examTitle.split(' ')[0])
      );
      if (partialMatch) {
        console.log(`   📌 Tìm thấy kỳ thi tương tự: "${partialMatch.exam_title}"`);
      }
      return;
    }

    console.log('   ✅ Tìm thấy kỳ thi!');
    console.log(`   ID: ${exam.exam_id}`);
    console.log(`   Tên: ${exam.exam_title}`);
    console.log(`   Loại: ${exam.exam_type}`);
    console.log(`   Lớp: ${exam.class_name || 'N/A'}`);
    console.log(`   Đã duyệt (is_approved): ${exam.is_approved} (${exam.is_approved === 1 || exam.is_approved === true ? '✅ CÓ' : '❌ KHÔNG'})`);
    console.log(`   Đã publish (is_published): ${exam.is_published} (${exam.is_published === 1 || exam.is_published === true ? '✅ CÓ' : '❌ KHÔNG'})`);
    console.log(`   Số câu hỏi: ${exam.questions_count || 0}`);

    // 2. Kiểm tra endpoint /lms/exams/student
    console.log('\n📋 Bước 2: Kiểm tra endpoint /lms/exams/student...');
    try {
      const studentExamsResponse = await api.get('/lms/exams/student');
      
      if (studentExamsResponse.data?.success && studentExamsResponse.data?.data) {
        const studentExams = Array.isArray(studentExamsResponse.data.data) 
          ? studentExamsResponse.data.data 
          : (studentExamsResponse.data.data.exams || []);
        
        console.log(`   ✅ Endpoint trả về ${studentExams.length} kỳ thi`);
        
        const foundExam = studentExams.find(e => e.exam_id === exam.exam_id);
        
        if (foundExam) {
          console.log('   ✅ Kỳ thi này CÓ trong danh sách kỳ thi của sinh viên!');
          console.log('   ✅ Menu "Thi & Kiểm tra" SẼ HIỂN THỊ');
        } else {
          console.log('   ❌ Kỳ thi này KHÔNG có trong danh sách kỳ thi của sinh viên!');
          console.log('   ❌ Menu "Thi & Kiểm tra" SẼ KHÔNG HIỂN THỊ');
          
          console.log('\n   🔍 LÝ DO KHÔNG HIỂN THỊ:');
          if (exam.is_approved !== 1 && exam.is_approved !== true) {
            console.log('      ❌ Kỳ thi chưa được duyệt (is_approved = ' + exam.is_approved + ')');
          }
          if (exam.is_published !== 1 && exam.is_published !== true) {
            console.log('      ❌ Kỳ thi chưa được publish (is_published = ' + exam.is_published + ')');
          }
          if (exam.questions_count === 0) {
            console.log('      ⚠️  Kỳ thi không có câu hỏi nào');
          }
          console.log('      ⚠️  Sinh viên có thể chưa được assign vào kỳ thi');
          console.log('      ⚠️  Hoặc sinh viên không khớp điều kiện lớp/khoa/ngành');
        }
        
        // Hiển thị danh sách kỳ thi của sinh viên
        if (studentExams.length > 0) {
          console.log('\n   📋 Danh sách kỳ thi của sinh viên:');
          studentExams.forEach((e, idx) => {
            console.log(`      ${idx + 1}. ${e.exam_title} (ID: ${e.exam_id})`);
          });
        }
      } else {
        console.log('   ❌ Endpoint không trả về dữ liệu hợp lệ');
      }
    } catch (error) {
      console.log('   ❌ Lỗi khi gọi endpoint:', error.message);
      if (error.response?.status === 401) {
        console.log('   ⚠️  Cần đăng nhập với tài khoản sinh viên');
      }
    }

    // 3. Tổng kết
    console.log('\n' + '='.repeat(80));
    console.log('📊 TỔNG KẾT:');
    console.log('='.repeat(80));
    
    const issues = [];
    if (exam.is_approved !== 1 && exam.is_approved !== true) {
      issues.push('❌ Kỳ thi chưa được duyệt (is_approved)');
    }
    if (exam.is_published !== 1 && exam.is_published !== true) {
      issues.push('❌ Kỳ thi chưa được publish (is_published)');
    }
    if (exam.questions_count === 0) {
      issues.push('⚠️  Kỳ thi không có câu hỏi nào');
    }
    
    if (issues.length === 0) {
      console.log('✅ TẤT CẢ ĐIỀU KIỆN ĐỀU ĐÁP ỨNG!');
      console.log('   Menu "Thi & Kiểm tra" sẽ hiển thị cho sinh viên đã được assign.');
    } else {
      console.log('❌ CÁC VẤN ĐỀ CẦN KHẮC PHỤC:');
      issues.forEach(issue => console.log(`   ${issue}`));
    }
    
    console.log('='.repeat(80));
    
    return {
      exam,
      issues,
      isReady: issues.length === 0
    };
  } catch (error) {
    console.error('❌ LỖI:', error);
    return null;
  }
}

// Export để có thể chạy trong browser console
if (typeof window !== 'undefined') {
  window.checkExamStatus = checkExamStatus;
}

