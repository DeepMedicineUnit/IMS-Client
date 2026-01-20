import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Badge, Accordion, Tabs, Tab, Table, InputGroup, Row, Col } from 'react-bootstrap';
import api from '../../utils/api';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Courses = () => {
  usePageTitle('Quản lý khóa học');
  const [categoryTree, setCategoryTree] = useState([]);
  // Load expanded categories from localStorage on mount
  const [expandedCategories, setExpandedCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('coursesExpandedCategories');
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(parsed.map(id => parseInt(id)));
      }
    } catch (error) {
      console.error('Error loading expanded categories from localStorage:', error);
    }
    return new Set();
  });
  const [categoryChildren, setCategoryChildren] = useState({}); // Store children for each category
  const [categoryCourses, setCategoryCourses] = useState({}); // Store courses for each category
  const [loading, setLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [accessTarget, setAccessTarget] = useState(null); // { type: 'category' | 'course', id: number }
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [courseModules, setCourseModules] = useState([]);
  const [breadcrumbPath, setBreadcrumbPath] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [categoryEditMode, setCategoryEditMode] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });
  const [creatingSubCategory, setCreatingSubCategory] = useState(false);

  // Access Management Modal states
  const [currentAccesses, setCurrentAccesses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [studentGroups, setStudentGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [majorFilter, setMajorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('Đang học');
  const [groupFilter, setGroupFilter] = useState('');
  const [useGroupMode, setUseGroupMode] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessModalTab, setAccessModalTab] = useState('current');
  
  // Drag and Drop states
  const [draggedItem, setDraggedItem] = useState(null); // { type: 'course' | 'category', id: number, categoryId: number }
  const [dragOverCategory, setDragOverCategory] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    category_id: '',
    department: '',
    status: '',
    level: ''
  });

  // Form data
  const [categoryForm, setCategoryForm] = useState({
    category_code: '',
    category_name: '',
    category_description: '',
    parent_category_id: '',
    icon: 'book',
    color: '#0d6efd',
    display_order: 0
  });

  const [courseForm, setCourseForm] = useState({
    category_id: '',
    course_code: '',
    course_name: '',
    description: '',
    department: '',
    credits: 0,
    total_hours: 0,
    course_level: 'undergraduate',
    course_status: 'draft'
  });

  const [moduleForm, setModuleForm] = useState({
    module_title: '',
    module_description: '',
    is_published: false
  });

  const [lessonForm, setLessonForm] = useState({
    lesson_title: '',
    lesson_type: 'lecture',
    content_html: '',
    duration_minutes: 0,
    is_mandatory: true
  });

  // Save expanded categories to localStorage whenever it changes
  useEffect(() => {
    try {
      const expandedArray = Array.from(expandedCategories);
      localStorage.setItem('coursesExpandedCategories', JSON.stringify(expandedArray));
    } catch (error) {
      console.error('Error saving expanded categories to localStorage:', error);
    }
  }, [expandedCategories]);

  useEffect(() => {
    fetchAllCategories();
  }, []);

  useEffect(() => {
    if (filters.search) {
      // Filter tree when search changes
      fetchAllCategories();
    }
  }, [filters.search]);

  // Load data for expanded categories when categoryTree is loaded
  useEffect(() => {
    if (categoryTree.length > 0 && expandedCategories.size > 0) {
      // Load data for all expanded categories
      const loadExpandedCategories = async () => {
        for (const categoryId of expandedCategories) {
          // Check if data is already loaded
          const hasData = categoryChildren[categoryId] !== undefined || categoryCourses[categoryId] !== undefined;
          if (!hasData) {
            await loadCategoryData(categoryId);
          }
        }
      };
      loadExpandedCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryTree]);

  // api.js already has baseURL='/api', so we don't need to add /api prefix
  // Just use the endpoint path directly
  const API_BASE_URL = '';

  const fetchAllCategories = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      // Fetch all categories
      const response = await api.get(`${API_BASE_URL}/lms/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const allCategories = response.data?.data || [];
      if (Array.isArray(allCategories)) {
        // Build tree structure
        const categoryMap = {};
        const rootCategories = [];

        // Create map
        allCategories.forEach(cat => {
          categoryMap[cat.category_id] = { 
            ...cat, 
            children: [], 
            courses: [],
            courses_count: 0,
            children_count: 0
          };
        });

        // Build tree
        allCategories.forEach(cat => {
          if (cat.parent_category_id) {
            const parent = categoryMap[cat.parent_category_id];
            if (parent) {
              parent.children.push(categoryMap[cat.category_id]);
              parent.children_count = (parent.children_count || 0) + 1;
            }
          } else {
            rootCategories.push(categoryMap[cat.category_id]);
          }
        });

        // Sort by display_order
        const sortByOrder = (categories) => {
          categories.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
          categories.forEach(cat => {
            if (cat.children.length > 0) {
              sortByOrder(cat.children);
            }
          });
        };
        sortByOrder(rootCategories);

        // Fetch counts for all categories (courses and children count)
        const fetchCounts = async () => {
          const countsPromises = allCategories.map(async (cat) => {
            try {
              // Get courses count
              const coursesResponse = await api.get(
                `${API_BASE_URL}/lms/courses?category_id=${cat.category_id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              const coursesData = coursesResponse.data?.data;
              const coursesCount = coursesData && Array.isArray(coursesData.courses) 
                ? coursesData.courses.length 
                : (Array.isArray(coursesData) ? coursesData.length : 0);

              // Children count is already available from tree structure
              const childrenCount = categoryMap[cat.category_id].children.length;

              return {
                categoryId: cat.category_id,
                coursesCount,
                childrenCount
              };
            } catch (error) {
              return {
                categoryId: cat.category_id,
                coursesCount: 0,
                childrenCount: 0
              };
            }
          });

          const counts = await Promise.all(countsPromises);
          const countsMap = {};
          counts.forEach(({ categoryId, coursesCount, childrenCount }) => {
            countsMap[categoryId] = { coursesCount, childrenCount };
          });

          // Update categories with counts
          const updateCounts = (categories) => {
            categories.forEach(cat => {
              const counts = countsMap[cat.category_id];
              if (counts) {
                cat.courses_count = counts.coursesCount;
                cat.children_count = counts.childrenCount;
              }
              if (cat.children.length > 0) {
                updateCounts(cat.children);
              }
            });
          };
          updateCounts(rootCategories);

          setCategoryTree(rootCategories);
        };

        fetchCounts();
      } else {
        setCategoryTree([]);
      }
    } catch (error) {
      console.error('Error fetching all categories:', error);
      setCategoryTree([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = async (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
      // Load children and courses if not already loaded
      await loadCategoryData(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const loadCategoryData = async (categoryId) => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch sub-categories
      const subCategoriesResponse = await api.get(
        `${API_BASE_URL}/lms/categories?parent_category_id=${categoryId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const subCategories = subCategoriesResponse.data?.data || [];

      // Fetch courses
      const coursesResponse = await api.get(
        `${API_BASE_URL}/lms/courses?category_id=${categoryId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const coursesData = coursesResponse.data?.data;
      const courses = coursesData && Array.isArray(coursesData.courses) 
        ? coursesData.courses 
        : (Array.isArray(coursesData) ? coursesData : []);

      // Sort sub-categories by display_order
      subCategories.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

      setCategoryChildren(prev => ({
        ...prev,
        [categoryId]: subCategories
      }));

      setCategoryCourses(prev => ({
        ...prev,
        [categoryId]: courses
      }));
    } catch (error) {
      console.error('Error loading category data:', error);
      setCategoryChildren(prev => ({
        ...prev,
        [categoryId]: []
      }));
      setCategoryCourses(prev => ({
        ...prev,
        [categoryId]: []
      }));
    }
  };

  const fetchCourseModules = async (courseId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.get(`${API_BASE_URL}/lms/courses/${courseId}/modules`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCourseModules(response.data.data || []);
    } catch (error) {
      console.error('Error fetching modules:', error);
      showAlert('Lỗi khi tải danh sách module', 'danger');
    }
  };

  // Category handlers
  const handleCreateCategory = (parentCategoryId = null) => {
    setCategoryEditMode(false);
    setCreatingSubCategory(!!parentCategoryId);
    setCategoryForm({
      category_code: '',
      category_name: '',
      category_description: '',
      parent_category_id: parentCategoryId || '',
      icon: 'book',
      color: '#0d6efd',
      display_order: 0
    });
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category) => {
    setCategoryEditMode(true);
    setSelectedCategory(category);
    setCategoryForm({
      category_code: category.category_code,
      category_name: category.category_name,
      category_description: category.category_description || '',
      parent_category_id: category.parent_category_id || '',
      icon: category.icon || 'book',
      color: category.color || '#0d6efd',
      display_order: category.display_order || 0
    });
    setShowCategoryModal(true);
  };

  const handleSubmitCategory = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      if (categoryEditMode && selectedCategory) {
        await api.put(
          `${API_BASE_URL}/lms/categories/${selectedCategory.category_id}`,
          categoryForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showAlert('Cập nhật danh mục thành công', 'success');
      } else {
        await api.post(
          `${API_BASE_URL}/lms/categories`,
          categoryForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showAlert('Tạo danh mục thành công', 'success');
      }

      setShowCategoryModal(false);
      await fetchAllCategories();
      // Clear cached data for the affected category
      if (categoryForm.parent_category_id) {
        setCategoryChildren(prev => {
          const updated = { ...prev };
          delete updated[categoryForm.parent_category_id];
          return updated;
        });
        setExpandedCategories(prev => {
          const newSet = new Set(prev);
          newSet.delete(categoryForm.parent_category_id);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error saving category:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi lưu danh mục', 'danger');
    }
  };

  const handleManageCategoryAccess = async (category) => {
    setAccessTarget({ type: 'category', id: category.category_id });
    setSelectedCategory(category);
    setShowAccessModal(true);
    await fetchCurrentAccesses('category', category.category_id);
    await fetchAccessFilterOptions();
  };

  const handleManageCourseAccess = async (course) => {
    setAccessTarget({ type: 'course', id: course.course_id });
    setSelectedCourse(course);
    setShowAccessModal(true);
    await fetchCurrentAccesses('course', course.course_id);
    await fetchAccessFilterOptions();
  };

  const fetchCurrentAccesses = async (type, id) => {
    try {
      setAccessLoading(true);
      const endpoint = type === 'category' 
        ? `/lms/categories/${id}/access`
        : `/lms/courses/${id}/access`;
      const response = await api.get(endpoint);
      if (response.data.success) {
        setCurrentAccesses(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching current accesses:', error);
      showAlert('Lỗi khi tải danh sách quyền truy cập', 'danger');
    } finally {
      setAccessLoading(false);
    }
  };

  const fetchAccessFilterOptions = async () => {
    try {
      // Fetch classes, faculties, majors
      const filterOptionsResponse = await api.get('/users/filter-options');
      if (filterOptionsResponse.data.success) {
        setClasses(filterOptionsResponse.data.classes?.map(c => c.name) || []);
        // Store faculties and majors for future use if needed
      }

      // Fetch student groups
      const groupsResponse = await api.get('/student-groups');
      if (groupsResponse.data?.success) {
        setStudentGroups(groupsResponse.data.data || []);
      }

      // Fetch students
      await fetchStudentsForAccess();
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchStudentsForAccess = async () => {
    try {
      let url = `/users?role=student&page=1&limit=100`;
      if (classFilter) url += `&class_name=${encodeURIComponent(classFilter)}`;
      if (facultyFilter) url += `&faculty_name=${encodeURIComponent(facultyFilter)}`;
      if (majorFilter) url += `&major_name=${encodeURIComponent(majorFilter)}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;

      const response = await api.get(url);
      if (response.data.success) {
        setStudents(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchStudentsByGroup = async (groupId) => {
    try {
      const response = await api.get(`/student-groups/${groupId}`);
      if (response.data?.success) {
        const groupStudents = response.data.data.students || [];
        setStudents(groupStudents);
        setSelectedStudents(groupStudents);
      }
    } catch (error) {
      console.error('Error fetching students by group:', error);
    }
  };

  const handleGrantAccess = async (accessType, ids, idType = 'ids') => {
    if (!accessTarget) return;

    try {
      setAccessLoading(true);
      const endpoint = accessTarget.type === 'category'
        ? `/lms/categories/${accessTarget.id}/access`
        : `/lms/courses/${accessTarget.id}/access`;

      let payload = { access_type: accessType };
      if (accessType === 'user') {
        payload.user_ids = ids;
      } else if (accessType === 'class') {
        if (idType === 'names') {
          payload.class_names = ids; // Send class names from users.class_name
        } else {
          payload.class_ids = ids; // Send class IDs from lms_classes
        }
      } else if (accessType === 'group') {
        payload.group_ids = ids;
      }

      const response = await api.post(endpoint, payload);
      if (response.data.success) {
        showAlert(response.data.message || 'Cấp quyền thành công', 'success');
        await fetchCurrentAccesses(accessTarget.type, accessTarget.id);
        // Clear selections
        setSelectedStudents([]);
        setSelectedClasses([]);
        setSelectedGroups([]);
      }
    } catch (error) {
      console.error('Error granting access:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi cấp quyền', 'danger');
    } finally {
      setAccessLoading(false);
    }
  };

  const handleRevokeAccess = async (accessId) => {
    if (!accessTarget) return;

    try {
      setAccessLoading(true);
      const endpoint = accessTarget.type === 'category'
        ? `/lms/categories/${accessTarget.id}/access/${accessId}`
        : `/lms/courses/${accessTarget.id}/access/${accessId}`;

      const response = await api.delete(endpoint);
      if (response.data.success) {
        showAlert('Đã thu hồi quyền truy cập', 'success');
        await fetchCurrentAccesses(accessTarget.type, accessTarget.id);
      }
    } catch (error) {
      console.error('Error revoking access:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi thu hồi quyền', 'danger');
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => {
    if (showAccessModal && accessModalTab !== 'current') {
      fetchStudentsForAccess();
    }
  }, [classFilter, facultyFilter, majorFilter, statusFilter, showAccessModal, accessModalTab]);

  useEffect(() => {
    if (useGroupMode && groupFilter && showAccessModal) {
      fetchStudentsByGroup(groupFilter);
    }
  }, [groupFilter, useGroupMode, showAccessModal]);

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return;

    try {
      const token = localStorage.getItem('token');
      await api.delete(`${API_BASE_URL}/lms/categories/${categoryId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showAlert('Xóa danh mục thành công', 'success');
      await fetchAllCategories();
      // Clear cached data
      setCategoryChildren(prev => {
        const updated = { ...prev };
        delete updated[categoryId];
        return updated;
      });
      setCategoryCourses(prev => {
        const updated = { ...prev };
        delete updated[categoryId];
        return updated;
      });
      setExpandedCategories(prev => {
        const newSet = new Set(prev);
        newSet.delete(categoryId);
        return newSet;
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi xóa danh mục', 'danger');
    }
  };

  const handleSelectCourse = (courseId, courseInfo = null) => {
    setSelectedCourseId(courseId);
    setExpandedCourse(courseId);
    
    // Find course info and build breadcrumb path
    if (!courseInfo) {
      // Find course in categoryCourses
      let foundCourse = null;
      
      for (const categoryId in categoryCourses) {
        const courses = categoryCourses[categoryId];
        const course = courses.find(c => c.course_id === courseId);
        if (course) {
          foundCourse = course;
          // Build path from categoryTree
          const result = findCourseAndPath(courseId, categoryTree);
          if (result) {
            setBreadcrumbPath(result.path);
            foundCourse = result.course;
          }
          break;
        }
      }
      
      if (foundCourse) {
        setSelectedCourse(foundCourse);
      }
    } else {
      setSelectedCourse(courseInfo);
      const result = findCourseAndPath(courseId, categoryTree);
      if (result) {
        setBreadcrumbPath(result.path);
      }
    }
    
    fetchCourseModules(courseId);
  };

  const handleBackToTree = () => {
    setSelectedCourseId(null);
    setSelectedCourse(null);
    setBreadcrumbPath([]);
    setExpandedCourse(null);
  };

  const handleCreateCourse = (categoryId = null) => {
    setEditMode(false);
    setCourseForm({
      category_id: categoryId || '',
      course_code: '',
      course_name: '',
      description: '',
      department: '',
      credits: 0,
      total_hours: 0,
      course_level: 'undergraduate',
      course_status: 'draft'
    });
    setShowCourseModal(true);
  };

  const handleEditCourse = (course) => {
    setEditMode(true);
    setSelectedCourse(course);
    setCourseForm({
      category_id: course.category_id || '',
      course_code: course.course_code,
      course_name: course.course_name,
      description: course.description || '',
      department: course.department || '',
      credits: course.credits || 0,
      total_hours: course.total_hours || 0,
      course_level: course.course_level,
      course_status: course.course_status
    });
    setShowCourseModal(true);
  };

  const handleSubmitCourse = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      if (editMode && selectedCourse) {
        await api.put(
          `${API_BASE_URL}/lms/courses/${selectedCourse.course_id}`,
          courseForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showAlert('Cập nhật khóa học thành công', 'success');
      } else {
        await api.post(
          `${API_BASE_URL}/lms/courses`,
          courseForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showAlert('Tạo khóa học thành công', 'success');
      }

      setShowCourseModal(false);
      await fetchAllCategories();
      // Clear cached courses for the category
      if (courseForm.category_id) {
        setCategoryCourses(prev => {
          const updated = { ...prev };
          delete updated[courseForm.category_id];
          return updated;
        });
      }
    } catch (error) {
      console.error('Error saving course:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi lưu khóa học', 'danger');
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khóa học này?')) return;

    try {
      const token = localStorage.getItem('token');
      await api.delete(`${API_BASE_URL}/lms/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showAlert('Xóa khóa học thành công', 'success');
      await fetchAllCategories();
      // Find and clear cached courses for the category
      const deletedCourse = Object.values(categoryCourses).flat().find(c => c.course_id === courseId);
      if (deletedCourse && deletedCourse.category_id) {
        setCategoryCourses(prev => {
          const updated = { ...prev };
          delete updated[deletedCourse.category_id];
          return updated;
        });
      }
    } catch (error) {
      console.error('Error deleting course:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi xóa khóa học', 'danger');
    }
  };

  const handleCloneCourse = async (courseId) => {
    const newCourseCode = prompt('Nhập mã khóa học mới:');
    const newCourseName = prompt('Nhập tên khóa học mới:');

    if (!newCourseCode || !newCourseName) return;

    try {
      const token = localStorage.getItem('token');
        await api.post(
        `${API_BASE_URL}/lms/courses/${courseId}/clone`,
        { new_course_code: newCourseCode, new_course_name: newCourseName },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showAlert('Sao chép khóa học thành công', 'success');
      await fetchAllCategories();
      // Find and clear cached courses for the category
      const clonedCourse = Object.values(categoryCourses).flat().find(c => c.course_id === courseId);
      if (clonedCourse && clonedCourse.category_id) {
        setCategoryCourses(prev => {
          const updated = { ...prev };
          delete updated[clonedCourse.category_id];
          return updated;
        });
      }
    } catch (error) {
      console.error('Error cloning course:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi sao chép khóa học', 'danger');
    }
  };

  const handleCreateModule = (courseId) => {
    setSelectedCourse({ course_id: courseId });
    setModuleForm({
      module_title: '',
      module_description: '',
      is_published: false
    });
    setShowModuleModal(true);
  };

  const handleSubmitModule = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
        await api.post(
        `${API_BASE_URL}/lms/courses/${selectedCourse.course_id}/modules`,
        moduleForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showAlert('Tạo module thành công', 'success');
      setShowModuleModal(false);
      fetchCourseModules(selectedCourse.course_id);
    } catch (error) {
      console.error('Error creating module:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi tạo module', 'danger');
    }
  };

  const handleCreateLesson = (moduleId) => {
    setSelectedModule({ module_id: moduleId });
    setLessonForm({
      lesson_title: '',
      lesson_type: 'lecture',
      content_html: '',
      duration_minutes: 0,
      is_mandatory: true
    });
    setShowLessonModal(true);
  };

  const handleSubmitLesson = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
        await api.post(
        `${API_BASE_URL}/lms/modules/${selectedModule.module_id}/lessons`,
        lessonForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showAlert('Tạo bài học thành công', 'success');
      setShowLessonModal(false);
      fetchCourseModules(expandedCourse);
    } catch (error) {
      console.error('Error creating lesson:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi tạo bài học', 'danger');
    }
  };

  const showAlert = (message, variant) => {
    setAlert({ show: true, message, variant });
    setTimeout(() => setAlert({ show: false, message: '', variant: '' }), 5000);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { bg: 'secondary', text: 'Nháp' },
      published: { bg: 'success', text: 'Đã xuất bản' },
      archived: { bg: 'warning', text: 'Đã lưu trữ' }
    };

    const config = statusConfig[status] || statusConfig.draft;
    return <Badge bg={config.bg}>{config.text}</Badge>;
  };

  const getLevelBadge = (level) => {
    const levelConfig = {
      undergraduate: { bg: 'primary', text: 'Đại học' },
      graduate: { bg: 'info', text: 'Sau đại học' },
      postgraduate: { bg: 'warning', text: 'Tiến sĩ' },
      continuing_education: { bg: 'secondary', text: 'Đào tạo liên tục' }
    };

    const config = levelConfig[level] || levelConfig.undergraduate;
    return <Badge bg={config.bg}>{config.text}</Badge>;
  };

  const getLessonIcon = (lessonType) => {
    const icons = {
      lecture: 'book',
      video: 'video',
      quiz: 'question-circle',
      assignment: 'tasks',
      discussion: 'comments',
      scorm: 'file-archive',
      xapi: 'exchange-alt',
      external_link: 'external-link-alt'
    };
    return icons[lessonType] || 'file';
  };

  // Helper function to find category in tree
  const findCategoryInTree = (categoryId, tree) => {
    for (const cat of tree) {
      if (cat.category_id === categoryId) {
        return cat;
      }
      if (cat.children && cat.children.length > 0) {
        const found = findCategoryInTree(categoryId, cat.children);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper function to find course and build category path
  const findCourseAndPath = (courseId, categories) => {
    const findCourseInCategories = (cats, path = []) => {
      for (const cat of cats) {
        // Check if course is in this category's courses
        const courses = categoryCourses[cat.category_id] || [];
        const course = courses.find(c => c.course_id === courseId);
        
        if (course) {
          return {
            course,
            path: [...path, { id: cat.category_id, name: cat.category_name, type: 'category' }]
          };
        }
        
        // Check children recursively
        if (cat.children && cat.children.length > 0) {
          const result = findCourseInCategories(cat.children, [...path, { id: cat.category_id, name: cat.category_name, type: 'category' }]);
          if (result) return result;
        }
      }
      return null;
    };
    
    return findCourseInCategories(categories);
  };

  // Helper function to get all categories from tree (flatten)
  const getAllCategoriesFromTree = (tree, result = []) => {
    tree.forEach(cat => {
      result.push(cat);
      if (cat.children && cat.children.length > 0) {
        getAllCategoriesFromTree(cat.children, result);
      }
    });
    return result;
  };

  // Drag and Drop handlers
  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // Required for Firefox
    // Add visual feedback
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedItem(null);
    setDragOverCategory(null);
  };

  const handleDragOver = (e, categoryId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Don't allow dropping on itself or its descendants
    if (draggedItem) {
      if (draggedItem.type === 'category' && draggedItem.id === categoryId) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }
      // Check if trying to drop category into its own descendant
      if (draggedItem.type === 'category') {
        const isDescendant = (catId, targetId, tree) => {
          const findCategory = (cats, id) => {
            for (const cat of cats) {
              if (cat.category_id === id) return cat;
              if (cat.children && cat.children.length > 0) {
                const found = findCategory(cat.children, id);
                if (found) return found;
              }
            }
            return null;
          };
          const targetCat = findCategory(tree, targetId);
          if (!targetCat) return false;
          
          const checkDescendant = (cat) => {
            if (cat.category_id === catId) return true;
            if (cat.children && cat.children.length > 0) {
              return cat.children.some(child => checkDescendant(child));
            }
            return false;
          };
          
          return checkDescendant(targetCat);
        };
        
        if (isDescendant(draggedItem.id, categoryId, categoryTree)) {
          e.dataTransfer.dropEffect = 'none';
          return;
        }
      }
    }
    
    setDragOverCategory(categoryId);
  };

  const handleDragLeave = (e) => {
    // Only clear if we're actually leaving the drop zone
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverCategory(null);
    }
  };

  const handleDrop = async (e, targetCategoryId) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedItem) return;
    
    try {
      const token = localStorage.getItem('token');
      
      if (draggedItem.type === 'course') {
        // Move course to new category (targetCategoryId can be null for root)
        await api.put(
          `${API_BASE_URL}/lms/courses/${draggedItem.id}`,
          { category_id: targetCategoryId || null },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showAlert('Di chuyển khóa học thành công', 'success');
        
        // Update local state
        const oldCategoryId = draggedItem.categoryId;
        const course = categoryCourses[oldCategoryId]?.find(c => c.course_id === draggedItem.id);
        
        if (course) {
          // Remove from old category
          setCategoryCourses(prev => ({
            ...prev,
            [oldCategoryId]: (prev[oldCategoryId] || []).filter(c => c.course_id !== draggedItem.id)
          }));
          
          // Add to new category (if targetCategoryId exists)
          if (targetCategoryId) {
            setCategoryCourses(prev => ({
              ...prev,
              [targetCategoryId]: [...(prev[targetCategoryId] || []), { ...course, category_id: targetCategoryId }]
            }));
          }
        }
      } else if (draggedItem.type === 'category') {
        // Move category to new parent (targetCategoryId can be null for root)
        await api.put(
          `${API_BASE_URL}/lms/categories/${draggedItem.id}`,
          { parent_category_id: targetCategoryId || null },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showAlert('Di chuyển danh mục thành công', 'success');
      }
      
      // Refresh tree
      await fetchAllCategories();
      
      // Clear cached data
      setCategoryChildren({});
      setCategoryCourses({});
      // Keep expanded state from localStorage
      
    } catch (error) {
      console.error('Error moving item:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi di chuyển', 'danger');
    } finally {
      setDraggedItem(null);
      setDragOverCategory(null);
    }
  };

  // Render tree structure recursively
  const renderTreeItem = (category, level = 0, parentPath = []) => {
    const isExpanded = expandedCategories.has(category.category_id);
    
    // Merge data from tree if available (for counts and children structure)
    const treeCategory = findCategoryInTree(category.category_id, categoryTree);
    const mergedCategory = treeCategory ? { ...category, ...treeCategory } : category;
    
    // Only use loaded data - don't use category.children from tree structure
    const children = categoryChildren[category.category_id] || [];
    const courses = categoryCourses[category.category_id] || [];
    const hasChildren = children.length > 0;
    const hasCourses = courses.length > 0;
    // Check if category has children in tree structure (to show expand icon)
    const hasChildrenInTree = mergedCategory.children && mergedCategory.children.length > 0;
    // Can expand if has courses count or children count
    const canExpand = (mergedCategory.courses_count > 0) || (mergedCategory.children_count > 0) || hasChildren || hasCourses || hasChildrenInTree;
    const indentSize = 24; // pixels per level
    const paddingLeft = level * indentSize + 12;

    // Build path for this category
    const currentPath = [...parentPath, mergedCategory];

    return (
      <React.Fragment key={category.category_id}>
        {/* Category Row */}
        <tr 
          className="tree-row"
          draggable={true}
          onDragStart={(e) => handleDragStart(e, { type: 'category', id: mergedCategory.category_id, categoryId: mergedCategory.parent_category_id })}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, mergedCategory.category_id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, mergedCategory.category_id)}
          style={{ 
            transition: 'all 0.2s ease',
            cursor: canExpand ? 'pointer' : 'default',
            backgroundColor: dragOverCategory === mergedCategory.category_id ? '#e3f2fd' : 'transparent',
            borderTop: dragOverCategory === mergedCategory.category_id ? '2px solid #2196f3' : 'none'
          }}
          onMouseEnter={(e) => {
            if (dragOverCategory !== mergedCategory.category_id) {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
            }
          }}
          onMouseLeave={(e) => {
            if (dragOverCategory !== mergedCategory.category_id) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
          onClick={() => canExpand && toggleCategory(mergedCategory.category_id)}
        >
          <td style={{ paddingLeft: `${paddingLeft}px`, paddingTop: '12px', paddingBottom: '12px' }}>
            <div className="d-flex align-items-center">
              {/* Expand/Collapse Icon */}
              {canExpand && (
                <div 
                  className="d-flex align-items-center justify-content-center me-2"
                  style={{
                    width: '20px',
                    height: '20px',
                    minWidth: '20px',
                    borderRadius: '4px',
                    backgroundColor: isExpanded ? '#0d6efd' : '#e9ecef',
                    color: isExpanded ? '#fff' : '#666',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCategory(mergedCategory.category_id);
                  }}
                >
                  <i 
                    className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}
                    style={{ fontSize: '10px' }}
                  ></i>
                </div>
              )}
              {!canExpand && <div style={{ width: '20px', marginRight: '8px' }}></div>}

              {/* Drag Handle Icon */}
              <div 
                className="me-2"
                style={{ 
                  cursor: 'grab',
                  color: '#6c757d',
                  fontSize: '12px'
                }}
                title="Kéo để di chuyển"
                onClick={(e) => e.stopPropagation()}
              >
                <i className="fas fa-grip-vertical"></i>
              </div>

              {/* Category Name */}
              <div className="flex-grow-1">
                <div className="d-flex align-items-center flex-wrap">
                  <strong style={{ 
                    fontSize: level === 0 ? '16px' : '15px', 
                    color: '#2c3e50', 
                    fontWeight: level === 0 ? 600 : 500
                  }}>
                    {mergedCategory.category_name}
                  </strong>
                  {(mergedCategory.courses_count > 0 || mergedCategory.children_count > 0) && (
                    <span className="text-muted ms-2" style={{ fontSize: '13px', fontWeight: 400 }}>
                      ({mergedCategory.courses_count || 0})
                    </span>
                  )}
                </div>
                {mergedCategory.category_description && (
                  <div className="text-muted small mt-1" style={{ fontSize: '13px' }}>
                    {mergedCategory.category_description.substring(0, 150)}
                    {mergedCategory.category_description.length > 150 && '...'}
                  </div>
                )}
              </div>
            </div>
          </td>
          <td style={{ paddingTop: '12px', paddingBottom: '12px' }}>
            <div className="d-flex gap-1 justify-content-end" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="light"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateCategory(mergedCategory.category_id);
                }}
                title="Tạo danh mục con"
                style={{ borderRadius: '6px', border: '1px solid #dee2e6', padding: '4px 8px' }}
              >
                <i className="fas fa-folder-plus text-success" style={{ fontSize: '12px' }}></i>
              </Button>
              <Button
                size="sm"
                variant="light"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateCourse(mergedCategory.category_id);
                }}
                title="Tạo khóa học"
                style={{ borderRadius: '6px', border: '1px solid #dee2e6', padding: '4px 8px' }}
              >
                <i className="fas fa-book text-info" style={{ fontSize: '12px' }}></i>
              </Button>
              <Button
                size="sm"
                variant="light"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditCategory(mergedCategory);
                }}
                title="Sửa"
                style={{ borderRadius: '6px', border: '1px solid #dee2e6', padding: '4px 8px' }}
              >
                <i className="fas fa-edit text-warning" style={{ fontSize: '12px' }}></i>
              </Button>
              <Button
                size="sm"
                variant="light"
                onClick={(e) => {
                  e.stopPropagation();
                  handleManageCategoryAccess(mergedCategory);
                }}
                title="Quản lý quyền truy cập"
                style={{ borderRadius: '6px', border: '1px solid #dee2e6', padding: '4px 8px' }}
              >
                <i className="fas fa-shield-alt text-primary" style={{ fontSize: '12px' }}></i>
              </Button>
              <Button
                size="sm"
                variant="light"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCategory(mergedCategory.category_id);
                }}
                title="Xóa"
                style={{ borderRadius: '6px', border: '1px solid #dee2e6', padding: '4px 8px' }}
              >
                <i className="fas fa-trash text-danger" style={{ fontSize: '12px' }}></i>
              </Button>
            </div>
          </td>
        </tr>

        {/* Render Sub-Categories */}
        {isExpanded && hasChildren && children.map((childCategory) => {
          // Merge with tree data if available
          const childTreeCategory = findCategoryInTree(childCategory.category_id, categoryTree);
          const mergedChild = childTreeCategory ? { ...childCategory, ...childTreeCategory } : childCategory;
          return renderTreeItem(mergedChild, level + 1, currentPath);
        })}

        {/* Render Courses */}
        {isExpanded && hasCourses && courses.map((course, index) => {
          const coursePaddingLeft = (level + 1) * indentSize + 12;
          return (
            <tr 
              key={course.course_id}
              className="tree-row course-row"
              draggable={true}
              onDragStart={(e) => handleDragStart(e, { type: 'course', id: course.course_id, categoryId: course.category_id })}
              onDragEnd={handleDragEnd}
              style={{ 
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                backgroundColor: '#fafbfc'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f7ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#fafbfc';
              }}
              onClick={() => handleSelectCourse(course.course_id, course)}
            >
              <td style={{ paddingLeft: `${coursePaddingLeft}px`, paddingTop: '10px', paddingBottom: '10px' }}>
                <div className="d-flex align-items-center">
                  <div style={{ width: '20px', marginRight: '8px' }}></div>
                  {/* Drag Handle Icon */}
                  <div 
                    className="me-2"
                    style={{ 
                      cursor: 'grab',
                      color: '#6c757d',
                      fontSize: '12px'
                    }}
                    title="Kéo để di chuyển"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <i className="fas fa-grip-vertical"></i>
                  </div>
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center flex-wrap">
                      <strong style={{ fontSize: '14px', color: '#2c3e50', fontWeight: 500 }}>
                        {course.course_name}
                      </strong>
                      <Badge bg="secondary" className="ms-2" style={{ fontSize: '11px' }}>
                        {course.course_code}
                      </Badge>
                      {getStatusBadge(course.course_status)}
                      <Badge bg="primary" className="ms-2" style={{ fontSize: '11px' }}>
                        {course.modules_count || 0} modules
                      </Badge>
                    </div>
                    {course.description && (
                      <div className="text-muted small mt-1" style={{ fontSize: '12px' }}>
                        {course.description.substring(0, 120)}
                        {course.description.length > 120 && '...'}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td style={{ paddingTop: '10px', paddingBottom: '10px' }}>
                <div className="d-flex gap-1 justify-content-end" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="light"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectCourse(course.course_id);
                    }}
                    title="Xem chi tiết"
                    style={{ borderRadius: '6px', border: '1px solid #dee2e6', padding: '4px 8px' }}
                  >
                    <i className="fas fa-arrow-right text-primary" style={{ fontSize: '12px' }}></i>
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditCourse(course);
                    }}
                    title="Sửa"
                    style={{ borderRadius: '6px', border: '1px solid #dee2e6', padding: '4px 8px' }}
                  >
                    <i className="fas fa-edit text-warning" style={{ fontSize: '12px' }}></i>
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloneCourse(course.course_id);
                    }}
                    title="Sao chép"
                    style={{ borderRadius: '6px', border: '1px solid #dee2e6', padding: '4px 8px' }}
                  >
                    <i className="fas fa-copy text-info" style={{ fontSize: '12px' }}></i>
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleManageCourseAccess(course);
                    }}
                    title="Quản lý quyền truy cập"
                    style={{ borderRadius: '6px', border: '1px solid #dee2e6', padding: '4px 8px' }}
                  >
                    <i className="fas fa-shield-alt text-primary" style={{ fontSize: '12px' }}></i>
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCourse(course.course_id);
                    }}
                    title="Xóa"
                    style={{ borderRadius: '6px', border: '1px solid #dee2e6', padding: '4px 8px' }}
                  >
                    <i className="fas fa-trash text-danger" style={{ fontSize: '12px' }}></i>
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </React.Fragment>
    );
  };

  return (
    <div className="container-fluid session-main-container">
      {/* Header */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Quản lý Khóa học</h1>
            <p className="header-subtitle">Quản lý danh mục, khóa học, module và bài học</p>
          </div>
          <div className="header-actions">
            {!selectedCourseId && (
              <Button variant="light" className="me-2" onClick={() => handleCreateCategory()}>
                <i className="fas fa-folder-plus me-2"></i>Tạo danh mục
              </Button>
            )}
            {selectedCourseId && (
              <Button variant="light" onClick={handleBackToTree}>
                <i className="fas fa-arrow-left me-2"></i>Quay lại
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Breadcrumb - Only show when course is selected */}
      {selectedCourseId && selectedCourse && breadcrumbPath.length > 0 && (
        <div className="d-flex align-items-center justify-content-center p-4" style={{ backgroundColor: '#f3f4f6' }}>
          <nav className="flex px-5 py-3 text-gray-700 border border-gray-200 rounded-lg" style={{ 
            backgroundColor: '#f9fafb',
            width: '100%',
            maxWidth: '100%'
          }} aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse" style={{ 
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              margin: 0,
              padding: 0,
              listStyle: 'none'
            }}>
              {/* Home */}
              <li className="inline-flex items-center">
                <button
                  onClick={handleBackToTree}
                  className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-teal-600"
                  style={{ 
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    color: '#374151'
                  }}
                >
                  <svg className="w-3 h-3 me-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20" style={{ width: '12px', height: '12px', marginRight: '8px' }}>
                    <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z" />
                  </svg>
                  Quản lý Khóa học
                </button>
              </li>
              
              {/* Categories */}
              {breadcrumbPath.map((item, index) => (
                <React.Fragment key={item.id}>
                  <li>
                    <div className="flex items-center" style={{ display: 'flex', alignItems: 'center' }}>
                      <svg className="rtl:rotate-180 block w-3 h-3 mx-1 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10" style={{ width: '12px', height: '12px', margin: '0 4px', color: '#9ca3af' }}>
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4" />
                      </svg>
                      <span className="ms-1 text-sm font-medium text-gray-700 md:ms-2" style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>
                        {item.name}
                      </span>
                    </div>
                  </li>
                </React.Fragment>
              ))}
              
              {/* Course */}
              <li>
                <div className="flex items-center" style={{ display: 'flex', alignItems: 'center' }}>
                  <svg className="rtl:rotate-180 block w-3 h-3 mx-1 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10" style={{ width: '12px', height: '12px', margin: '0 4px', color: '#9ca3af' }}>
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4" />
                  </svg>
                  <span className="ms-1 text-sm font-medium text-gray-700 md:ms-2" style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>
                    {selectedCourse.course_name}
                  </span>
                </div>
              </li>
            </ol>
          </nav>
        </div>
      )}

      {/* Alert */}
      {alert.show && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert({ ...alert, show: false })}>
          {alert.message}
        </Alert>
      )}

      {/* Tree View - When no course selected */}
      {!selectedCourseId && (
        <div className="session-table-container" style={{ 
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div className="text-center p-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Đang tải...</span>
        </div>
      </div>
          ) : (
        <div className="table-responsive-mobile">
              <table className="session-table" style={{ margin: 0 }}>
                <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <tr>
                    <th style={{ padding: '16px 20px', fontWeight: 600, fontSize: '14px', color: '#495057' }}>
                      <i className="fas fa-sitemap me-2"></i>
                      Danh mục / Khóa học
                    </th>
                    <th style={{ width: '200px', padding: '16px 20px', fontWeight: 600, fontSize: '14px', color: '#495057', textAlign: 'right' }}>
                      <i className="fas fa-cog me-2"></i>
                      Hành động
                    </th>
              </tr>
            </thead>
            <tbody>
                  {/* Root level drop zone */}
                  {draggedItem && (
                    <tr
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverCategory('root');
                      }}
                      onDragLeave={() => {
                        if (dragOverCategory === 'root') {
                          setDragOverCategory(null);
                        }
                      }}
                      onDrop={(e) => handleDrop(e, null)}
                      style={{
                        backgroundColor: dragOverCategory === 'root' ? '#e3f2fd' : 'transparent',
                        borderTop: dragOverCategory === 'root' ? '2px solid #2196f3' : 'none',
                        height: dragOverCategory === 'root' ? '40px' : '20px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <td colSpan="2" style={{ padding: '10px', textAlign: 'center', color: '#2196f3', fontWeight: 500 }}>
                        {dragOverCategory === 'root' && 'Thả vào đây để di chuyển lên cấp gốc'}
                      </td>
                    </tr>
                  )}
                  
                  {!Array.isArray(categoryTree) || categoryTree.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="text-center p-5" style={{ padding: '60px 20px' }}>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          margin: '0 auto 20px',
                          borderRadius: '50%',
                          backgroundColor: '#e9ecef',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <i className="fas fa-folder fa-2x text-muted"></i>
                        </div>
                        <h5 style={{ color: '#6c757d', marginBottom: '8px', fontWeight: 500 }}>
                          Chưa có danh mục nào
                        </h5>
                        <p className="text-muted mb-4" style={{ fontSize: '14px' }}>
                          Bắt đầu bằng cách tạo danh mục đầu tiên của bạn
                        </p>
                        <Button 
                          variant="primary" 
                          onClick={() => handleCreateCategory()}
                          style={{
                            borderRadius: '8px',
                            padding: '10px 24px',
                            fontWeight: 500
                          }}
                        >
                          <i className="fas fa-plus me-2"></i>
                          Tạo danh mục mới
                        </Button>
                      </td>
                </tr>
                  ) : (
                    categoryTree.map((category) => renderTreeItem(category))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modules & Lessons View - When course selected */}
      {selectedCourseId && (
        <div className="session-table-container" style={{ 
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          padding: '20px',
          marginTop: '20px'
        }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5>Module & Bài học</h5>
            <Button size="sm" variant="primary" onClick={() => handleCreateModule(selectedCourseId)}>
              <i className="fas fa-plus me-2"></i>Thêm Module
            </Button>
          </div>

          {courseModules.length === 0 ? (
            <div className="text-center p-4">
              <p className="text-muted">Chưa có module nào</p>
            </div>
          ) : (
            <Accordion>
              {courseModules.map((module) => (
                <Accordion.Item key={module.module_id} eventKey={module.module_id.toString()}>
                  <Accordion.Header>
                    <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                      <div>
                        <strong>{module.module_title}</strong>
                        <Badge bg="secondary" className="ms-2">
                          {module.lessons_count || 0} bài học
                        </Badge>
                      </div>
                    </div>
                  </Accordion.Header>
                  <Accordion.Body>
                    <div className="mb-3">
                      <p className="text-muted">{module.module_description}</p>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6>Bài học</h6>
                      <Button size="sm" variant="outline-primary" onClick={() => handleCreateLesson(module.module_id)}>
                        <i className="fas fa-plus me-2"></i>Thêm bài học
                      </Button>
                    </div>

                    {module.lessons && module.lessons.length > 0 ? (
                      <ul className="list-group">
                        {module.lessons.map((lesson) => (
                          <li key={lesson.lesson_id} className="list-group-item">
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <i className={`fas fa-${getLessonIcon(lesson.lesson_type)} me-2`}></i>
                                <strong>{lesson.lesson_title}</strong>
                                <Badge bg="info" className="ms-2">{lesson.lesson_type}</Badge>
                                {lesson.duration_minutes > 0 && (
                                  <Badge bg="secondary" className="ms-2">{lesson.duration_minutes} phút</Badge>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted">Chưa có bài học nào</p>
                    )}
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </div>
      )}

      {/* Category Modal */}
      <Modal show={showCategoryModal} onHide={() => setShowCategoryModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{categoryEditMode ? 'Chỉnh sửa danh mục' : 'Tạo danh mục mới'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitCategory}>
          <Modal.Body>
            {creatingSubCategory && categoryForm.parent_category_id && (
              <Alert variant="info" className="mb-3">
                <i className="fas fa-info-circle me-2"></i>
                Đang tạo danh mục con cho: <strong>
                  {(() => {
                    const parentId = parseInt(categoryForm.parent_category_id);
                    const allCategories = getAllCategoriesFromTree(categoryTree);
                    const parentCategory = allCategories.find(c => c.category_id === parentId);
                    return parentCategory?.category_name || 'Danh mục cha';
                  })()}
                </strong>
              </Alert>
            )}

            {!creatingSubCategory && !categoryEditMode && (
              <Form.Group className="mb-3">
                <Form.Label>Danh mục cha (tùy chọn)</Form.Label>
                <Form.Select
                  value={categoryForm.parent_category_id || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, parent_category_id: e.target.value || null })}
                >
                  <option value="">Không có (Danh mục gốc)</option>
                  {getAllCategoriesFromTree(categoryTree).map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Mã danh mục *</Form.Label>
              <Form.Control
                type="text"
                value={categoryForm.category_code}
                onChange={(e) => setCategoryForm({ ...categoryForm, category_code: e.target.value })}
                required
                disabled={categoryEditMode}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Tên danh mục *</Form.Label>
              <Form.Control
                type="text"
                value={categoryForm.category_name}
                onChange={(e) => setCategoryForm({ ...categoryForm, category_name: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Mô tả</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={categoryForm.category_description}
                onChange={(e) => setCategoryForm({ ...categoryForm, category_description: e.target.value })}
              />
            </Form.Group>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Icon</Form.Label>
                  <Form.Control
                    type="text"
                    value={categoryForm.icon}
                    onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                    placeholder="folder, book, heart, etc."
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Màu sắc</Form.Label>
                  <Form.Control
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  />
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Thứ tự hiển thị</Form.Label>
              <Form.Control
                type="number"
                value={categoryForm.display_order}
                onChange={(e) => setCategoryForm({ ...categoryForm, display_order: parseInt(e.target.value) || 0 })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              {categoryEditMode ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Course Modal */}
      <Modal show={showCourseModal} onHide={() => setShowCourseModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editMode ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitCourse}>
          <Modal.Body>
            {!courseForm.category_id && (
              <Form.Group className="mb-3">
                <Form.Label>Danh mục *</Form.Label>
                <Form.Select
                  value={courseForm.category_id}
                  onChange={(e) => setCourseForm({ ...courseForm, category_id: e.target.value })}
                  required
                >
                  <option value="">Chọn danh mục</option>
                  {getAllCategoriesFromTree(categoryTree).map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}
            {courseForm.category_id && (
              <Form.Group className="mb-3">
                <Form.Label>Danh mục</Form.Label>
                <Form.Control
                  type="text"
                  value={(() => {
                    const allCategories = getAllCategoriesFromTree(categoryTree);
                    const cat = allCategories.find(c => c.category_id === parseInt(courseForm.category_id));
                    return cat ? cat.category_name : '';
                  })()}
                  disabled
                />
              </Form.Group>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Mã khóa học *</Form.Label>
              <Form.Control
                type="text"
                value={courseForm.course_code}
                onChange={(e) => setCourseForm({ ...courseForm, course_code: e.target.value })}
                required
                disabled={editMode}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Tên khóa học *</Form.Label>
              <Form.Control
                type="text"
                value={courseForm.course_name}
                onChange={(e) => setCourseForm({ ...courseForm, course_name: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Mô tả</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={courseForm.description}
                onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
              />
            </Form.Group>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Khoa</Form.Label>
                  <Form.Select
                    value={courseForm.department}
                    onChange={(e) => setCourseForm({ ...courseForm, department: e.target.value })}
                  >
                    <option value="">Chọn khoa</option>
                    <option value="Nội">Khoa Nội</option>
                    <option value="Ngoại">Khoa Ngoại</option>
                    <option value="Sản">Khoa Sản</option>
                    <option value="Nhi">Khoa Nhi</option>
                    <option value="Kỹ năng">Kỹ năng lâm sàng</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Trạng thái</Form.Label>
                  <Form.Select
                    value={courseForm.course_status}
                    onChange={(e) => setCourseForm({ ...courseForm, course_status: e.target.value })}
                  >
                    <option value="draft">Nháp</option>
                    <option value="published">Đã xuất bản</option>
                    <option value="archived">Đã lưu trữ</option>
                  </Form.Select>
                </Form.Group>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Số tín chỉ</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.1"
                    value={courseForm.credits}
                    onChange={(e) => setCourseForm({ ...courseForm, credits: parseFloat(e.target.value) })}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Tổng số giờ</Form.Label>
                  <Form.Control
                    type="number"
                    value={courseForm.total_hours}
                    onChange={(e) => setCourseForm({ ...courseForm, total_hours: parseInt(e.target.value) })}
                  />
                </Form.Group>
        </div>
      </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCourseModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              {editMode ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Module Modal */}
      <Modal show={showModuleModal} onHide={() => setShowModuleModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Tạo Module mới</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitModule}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Tên module *</Form.Label>
              <Form.Control
                type="text"
                value={moduleForm.module_title}
                onChange={(e) => setModuleForm({ ...moduleForm, module_title: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Mô tả</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={moduleForm.module_description}
                onChange={(e) => setModuleForm({ ...moduleForm, module_description: e.target.value })}
              />
            </Form.Group>

            <Form.Check
              type="checkbox"
              label="Xuất bản ngay"
              checked={moduleForm.is_published}
              onChange={(e) => setModuleForm({ ...moduleForm, is_published: e.target.checked })}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModuleModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Tạo Module
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Lesson Modal */}
      <Modal show={showLessonModal} onHide={() => setShowLessonModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Tạo Bài học mới</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitLesson}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Tên bài học *</Form.Label>
              <Form.Control
                type="text"
                value={lessonForm.lesson_title}
                onChange={(e) => setLessonForm({ ...lessonForm, lesson_title: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Loại bài học</Form.Label>
              <Form.Select
                value={lessonForm.lesson_type}
                onChange={(e) => setLessonForm({ ...lessonForm, lesson_type: e.target.value })}
              >
                <option value="lecture">Bài giảng</option>
                <option value="video">Video</option>
                <option value="quiz">Quiz</option>
                <option value="assignment">Bài tập</option>
                <option value="scorm">SCORM</option>
                <option value="xapi">xAPI</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Nội dung</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                value={lessonForm.content_html}
                onChange={(e) => setLessonForm({ ...lessonForm, content_html: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Thời lượng (phút)</Form.Label>
              <Form.Control
                type="number"
                value={lessonForm.duration_minutes}
                onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: parseInt(e.target.value) })}
              />
            </Form.Group>

            <Form.Check
              type="checkbox"
              label="Bắt buộc"
              checked={lessonForm.is_mandatory}
              onChange={(e) => setLessonForm({ ...lessonForm, is_mandatory: e.target.checked })}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowLessonModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Tạo Bài học
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Access Management Modal */}
      <Modal show={showAccessModal} onHide={() => {
        setShowAccessModal(false);
        setAccessModalTab('current');
        setSelectedStudents([]);
        setSelectedClasses([]);
        setSelectedGroups([]);
        setClassFilter('');
        setFacultyFilter('');
        setMajorFilter('');
        setGroupFilter('');
        setUseGroupMode(false);
      }} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-shield-alt me-2"></i>
            Quản lý quyền truy cập - {accessTarget?.type === 'category' ? selectedCategory?.category_name : selectedCourse?.course_name}
            {accessTarget?.type === 'category' && (
              <Badge bg="info" className="ms-2">Danh mục (tất cả khóa học trong danh mục)</Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Tabs activeKey={accessModalTab} onSelect={(k) => setAccessModalTab(k)} className="mb-3">
            {/* Current Access Tab */}
            <Tab eventKey="current" title={<span><i className="fas fa-list me-2"></i>Quyền hiện tại</span>}>
              {accessLoading ? (
                <div className="text-center p-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Đang tải...</span>
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table striped hover>
                    <thead>
                      <tr>
                        <th>Loại</th>
                        <th>Tên</th>
                        <th>Người cấp</th>
                        <th>Ngày cấp</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentAccesses.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center p-4">
                            <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                            <p className="text-muted">Chưa có quyền truy cập nào được cấp</p>
                          </td>
                        </tr>
                      ) : (
                        currentAccesses.map((access) => (
                          <tr key={access.access_id}>
                            <td>
                              <Badge bg={
                                access.access_type === 'user' ? 'primary' :
                                access.access_type === 'class' ? 'success' : 'info'
                              }>
                                {access.access_type === 'user' ? 'Sinh viên' :
                                 access.access_type === 'class' ? 'Lớp học' : 'Nhóm'}
                              </Badge>
                            </td>
                            <td>
                              {access.user_name && `${access.user_name} (${access.student_id || 'N/A'})`}
                              {access.class_name && access.class_name}
                              {access.group_name && access.group_name}
                            </td>
                            <td>{access.granted_by_name || 'N/A'}</td>
                            <td>{new Date(access.created_at).toLocaleDateString('vi-VN')}</td>
                            <td>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => handleRevokeAccess(access.access_id)}
                              >
                                <i className="fas fa-times"></i> Thu hồi
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
              )}
            </Tab>

            {/* Add Users Tab */}
            <Tab eventKey="users" title={<span><i className="fas fa-users me-2"></i>Thêm sinh viên</span>}>
              <div className="mb-3">
                <Row>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Lớp</Form.Label>
                      <Form.Select
                        value={classFilter}
                        onChange={(e) => {
                          setClassFilter(e.target.value);
                          setUseGroupMode(false);
                          setGroupFilter('');
                        }}
                      >
                        <option value="">-- Tất cả lớp --</option>
                        {classes.map((className, index) => (
                          <option key={index} value={className}>{className}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Nhóm sinh viên</Form.Label>
                      <Form.Select
                        value={groupFilter}
                        onChange={(e) => {
                          setGroupFilter(e.target.value);
                          setUseGroupMode(!!e.target.value);
                          if (!e.target.value) {
                            setClassFilter('');
                            setFacultyFilter('');
                            setMajorFilter('');
                          }
                        }}
                      >
                        <option value="">-- Chọn nhóm sinh viên --</option>
                        {studentGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.group_name} ({group.student_count || 0} sinh viên)
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => setSelectedStudents([])}
                      className="me-2"
                    >
                      <i className="fas fa-times-circle me-1"></i>Bỏ chọn tất cả
                    </Button>
                    <Button
                      variant="outline-success"
                      size="sm"
                      onClick={() => setSelectedStudents(students)}
                    >
                      <i className="fas fa-check-circle me-1"></i>Chọn tất cả
                    </Button>
                  </div>
                  <div>
                    <Badge bg="primary" pill>Đã chọn: {selectedStudents.length}</Badge>
                  </div>
                </div>
              </div>

              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <Table striped hover>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 }}>
                    <tr>
                      <th style={{ width: '50px' }}>
                        <Form.Check
                          type="checkbox"
                          checked={students.length > 0 && selectedStudents.length === students.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudents(students);
                            } else {
                              setSelectedStudents([]);
                            }
                          }}
                        />
                      </th>
                      <th>Mã SV</th>
                      <th>Họ và tên</th>
                      <th>Lớp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-3">
                          <i className="fas fa-search me-2"></i>Không tìm thấy sinh viên nào
                        </td>
                      </tr>
                    ) : (
                      students.map((student) => (
                        <tr 
                          key={student.id} 
                          className={selectedStudents.some(s => s.id === student.id) ? 'table-active' : ''}
                          onClick={() => {
                            const isSelected = selectedStudents.some(s => s.id === student.id);
                            if (isSelected) {
                              setSelectedStudents(selectedStudents.filter(s => s.id !== student.id));
                            } else {
                              setSelectedStudents([...selectedStudents, student]);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <Form.Check
                              type="checkbox"
                              checked={selectedStudents.some(s => s.id === student.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudents([...selectedStudents, student]);
                                } else {
                                  setSelectedStudents(selectedStudents.filter(s => s.id !== student.id));
                                }
                              }}
                            />
                          </td>
                          <td>{student.student_id}</td>
                          <td>{student.full_name}</td>
                          <td>{student.class_name}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>

              <div className="mt-3">
                <Button
                  variant="primary"
                  onClick={() => {
                    const userIds = selectedStudents.map(s => s.id);
                    if (userIds.length > 0) {
                      handleGrantAccess('user', userIds);
                    } else {
                      showAlert('Vui lòng chọn ít nhất một sinh viên', 'warning');
                    }
                  }}
                  disabled={selectedStudents.length === 0 || accessLoading}
                >
                  <i className="fas fa-plus me-2"></i>
                  Cấp quyền cho {selectedStudents.length} sinh viên
                </Button>
              </div>
            </Tab>



          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowAccessModal(false);
            setAccessModalTab('current');
            setSelectedStudents([]);
            setSelectedClasses([]);
            setSelectedGroups([]);
          }}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Courses;


