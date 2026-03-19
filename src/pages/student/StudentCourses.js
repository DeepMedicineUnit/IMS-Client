import React, { useState, useEffect } from 'react';
import { Badge, Button, Card, Accordion, Spinner } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';
import { useTranslation } from 'react-i18next';

const StudentCourses = () => {
  const { t } = useTranslation();
  usePageTitle(t('studentCourses.title'));
  const { currentUser } = useAuth();
  const [categoryTree, setCategoryTree] = useState([]);
  // Load expanded categories from localStorage on mount
  const [expandedCategories, setExpandedCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('studentCoursesExpandedCategories');
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(parsed.map(id => parseInt(id)));
      }
    } catch (error) {
      console.error('Error loading expanded categories from localStorage:', error);
    }
    return new Set();
  });
  const [categoryCourses, setCategoryCourses] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseModules, setCourseModules] = useState([]);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [breadcrumbPath, setBreadcrumbPath] = useState([]);

  // Save expanded categories to localStorage whenever it changes
  useEffect(() => {
    try {
      const expandedArray = Array.from(expandedCategories);
      localStorage.setItem('studentCoursesExpandedCategories', JSON.stringify(expandedArray));
    } catch (error) {
      console.error('Error saving expanded categories to localStorage:', error);
    }
  }, [expandedCategories]);

  useEffect(() => {
    fetchAccessibleCategories();
  }, []);

  // Load courses for expanded categories when categoryTree is loaded
  useEffect(() => {
    if (categoryTree.length > 0 && expandedCategories.size > 0) {
      // Load courses for all expanded categories
      const loadExpandedCategories = async () => {
        for (const categoryId of expandedCategories) {
          // Check if courses are already loaded
          const hasCourses = categoryCourses[categoryId] !== undefined;
          if (!hasCourses) {
            await loadCategoryCourses(categoryId);
          }
        }
      };
      loadExpandedCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryTree]);

  const fetchAccessibleCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/lms/categories?for_student=true&include_courses=true');
      const allCategories = response.data?.data || [];
      
      if (Array.isArray(allCategories)) {
        // Build tree structure
        const categoryMap = {};
        const rootCategories = [];

        allCategories.forEach(cat => {
          categoryMap[cat.category_id] = { 
            ...cat, 
            children: [], 
            courses: [],
            courses_count: cat.courses_count || 0, // Preserve courses_count from API
            children_count: 0
          };
        });

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

        const sortByOrder = (categories) => {
          categories.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
          categories.forEach(cat => {
            if (cat.children.length > 0) {
              sortByOrder(cat.children);
            }
          });
        };
        sortByOrder(rootCategories);

        setCategoryTree(rootCategories);

        // Auto-load courses for all categories that have courses_count > 0
        const loadCoursesRecursively = async (cats) => {
          for (const cat of cats) {
            if (cat.courses_count > 0) {
              // Load courses for this category
              loadCategoryCourses(cat.category_id);
            }
            // Recursively load courses for children
            if (cat.children && cat.children.length > 0) {
              await loadCoursesRecursively(cat.children);
            }
          }
        };
        
        // Start loading courses after a short delay to avoid blocking UI
        setTimeout(() => {
          loadCoursesRecursively(rootCategories);
        }, 100);
      } else {
        setCategoryTree([]);
      }
    } catch (error) {
      console.error('Error fetching accessible categories:', error);
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
      // Load courses if not already loaded
      if (!categoryCourses[categoryId]) {
        await loadCategoryCourses(categoryId);
      } else {
      }
    }
    setExpandedCategories(newExpanded);
  };

  const loadCategoryCourses = async (categoryId) => {
    try {
      const response = await api.get(
        `/lms/courses?category_id=${categoryId}&for_student=true`
      );
      
      const coursesData = response.data?.data;
      
      const courses = coursesData && Array.isArray(coursesData.courses) 
        ? coursesData.courses 
        : (Array.isArray(coursesData) ? coursesData : []);
      

      setCategoryCourses(prev => {
        const updated = {
          ...prev,
          [categoryId]: courses
        };
        return updated;
      });
    } catch (error) {
      console.error(`[StudentCourses] Error loading category courses for category ${categoryId}:`, error);
      console.error('[StudentCourses] Error details:', error.response?.data || error.message);
      setCategoryCourses(prev => ({
        ...prev,
        [categoryId]: []
      }));
    }
  };

  // Auto-load courses for categories that have courses_count > 0
  const autoLoadCoursesForCategories = async (categories) => {
    const categoriesToLoad = [];
    
    const findCategoriesWithCourses = (cats) => {
      cats.forEach(cat => {
        if (cat.courses_count > 0 && !categoryCourses[cat.category_id]) {
          categoriesToLoad.push(cat.category_id);
        }
        if (cat.children && cat.children.length > 0) {
          findCategoriesWithCourses(cat.children);
        }
      });
    };
    
    findCategoriesWithCourses(categories);
    
    // Load courses for all categories with courses_count > 0
    await Promise.all(categoriesToLoad.map(categoryId => loadCategoryCourses(categoryId)));
  };

  const fetchCourseModules = async (courseId) => {
    try {
      const response = await api.get(`/lms/courses/${courseId}/modules`);

      setCourseModules(response.data.data || []);
    } catch (error) {
      console.error('Error fetching modules:', error);
    }
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

  const handleSelectCourse = async (courseId, courseInfo = null) => {
    setSelectedCourseId(courseId);
    setExpandedCourse(courseId);
    
    // Find course info and build breadcrumb path
    if (!courseInfo) {
      // Find course in categoryCourses
      let foundCourse = null;
      let foundPath = [];
      
      for (const categoryId in categoryCourses) {
        const courses = categoryCourses[categoryId];
        const course = courses.find(c => c.course_id === courseId);
        if (course) {
          foundCourse = course;
          // Build path from categoryTree
          const result = findCourseAndPath(courseId, categoryTree);
          if (result) {
            foundPath = result.path;
            foundCourse = result.course;
          }
          break;
        }
      }
      
      if (foundCourse) {
        setSelectedCourse(foundCourse);
        setBreadcrumbPath(foundPath);
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
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { bg: 'secondary', text: t('studentCourses.status.draft') },
      published: { bg: 'success', text: t('studentCourses.status.published') },
      archived: { bg: 'warning', text: t('studentCourses.status.archived') }
    };

    const config = statusConfig[status] || statusConfig.draft;
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

  const renderTreeItem = (category, level = 0) => {
    const isExpanded = expandedCategories.has(category.category_id);
    const courses = categoryCourses[category.category_id] || [];
    const hasCourses = courses.length > 0;
    const hasCoursesCount = (category.courses_count || 0) > 0;
    const canExpand = category.courses_count > 0 || category.children_count > 0 || hasCourses;
    const indentSize = 24;
    const paddingLeft = level * indentSize + 12;

    // Debug log for rendering
    if (hasCoursesCount || hasCourses) {
    }

    return (
      <React.Fragment key={category.category_id}>
        <tr 
          className="tree-row"
          style={{ 
            transition: 'all 0.2s ease',
            cursor: canExpand ? 'pointer' : 'default'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          onClick={() => canExpand && toggleCategory(category.category_id)}
        >
          <td style={{ paddingLeft: `${paddingLeft}px`, paddingTop: '12px', paddingBottom: '12px' }}>
            <div className="d-flex align-items-center">
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
                    toggleCategory(category.category_id);
                  }}
                >
                  <i 
                    className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}
                    style={{ fontSize: '10px' }}
                  ></i>
                </div>
              )}
              {!canExpand && <div style={{ width: '20px', marginRight: '8px' }}></div>}

              <div className="flex-grow-1">
                <div className="d-flex align-items-center flex-wrap">
                  <strong style={{ 
                    fontSize: level === 0 ? '16px' : '15px', 
                    color: '#2c3e50', 
                    fontWeight: level === 0 ? 600 : 500
                  }}>
                    {category.category_name}
                  </strong>
                  {(category.courses_count > 0 || category.children_count > 0) && (
                    <span className="text-muted ms-2" style={{ fontSize: '13px', fontWeight: 400 }}>
                      ({category.courses_count || 0})
                    </span>
                  )}
                </div>
                {category.category_description && (
                  <div className="text-muted small mt-1" style={{ fontSize: '13px' }}>
                    {category.category_description.substring(0, 150)}
                    {category.category_description.length > 150 && '...'}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>

        {isExpanded && category.children && category.children.length > 0 && category.children.map((childCategory) => {
          return renderTreeItem(childCategory, level + 1);
        })}

        {isExpanded && (() => {
          if (hasCourses) {
          } else if (hasCoursesCount) {
          }
          return null;
        })()}

        {isExpanded && hasCourses && courses.map((course) => {
          const coursePaddingLeft = (level + 1) * indentSize + 12;
          return (
            <tr 
              key={course.course_id}
              className="tree-row course-row"
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
                        {t('studentCourses.modulesCount', { count: course.modules_count || 0 })}
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
            </tr>
          );
        })}
      </React.Fragment>
    );
  };

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>{t('studentCourses.headerTitle')}</h1>
          </div>
          <div className="header-actions">
            {selectedCourseId && (
              <Button variant="light" onClick={handleBackToTree}>
                <i className="fas fa-arrow-left me-2"></i>{t('studentCourses.back')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Breadcrumb - Only show when course is selected */}
      {selectedCourseId && selectedCourse && breadcrumbPath.length > 0 && (
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
                  {t('studentCourses.headerTitle')}
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
      )}

      {!selectedCourseId && (
        <div className="session-table-container" style={{ 
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div className="text-center p-5">
              <Spinner animation="border" />
              <p className="mt-3">{t('studentCourses.loading')}</p>
            </div>
          ) : (
            <div className="table-responsive-mobile">
              <table className="session-table" style={{ margin: 0 }}>
                <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <tr>
                    <th style={{ padding: '16px 20px', fontWeight: 600, fontSize: '14px', color: '#495057' }}>
                      <i className="fas fa-sitemap me-2"></i>
                      {t('studentCourses.tableHeader')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!Array.isArray(categoryTree) || categoryTree.length === 0 ? (
                    <tr>
                      <td className="text-center p-5" style={{ padding: '60px 20px' }}>
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
                          {t('studentCourses.noCourses.title')}
                        </h5>
                        <p className="text-muted mb-4" style={{ fontSize: '14px' }}>
                          {t('studentCourses.noCourses.description')}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      return categoryTree.map((category) => renderTreeItem(category));
                    })()
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedCourseId && (
        <div className="session-table-container" style={{ 
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          padding: '20px',
          marginTop: '20px'
        }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5>{t('studentCourses.modulesAndLessons')}</h5>
          </div>

          {courseModules.length === 0 ? (
            <div className="text-center p-4">
              <p className="text-muted">{t('studentCourses.noModules')}</p>
            </div>
          ) : (
            <Accordion>
              {courseModules.map((module) => (
                <Accordion.Item key={module.module_id} eventKey={module.module_id.toString()}>
                  <Accordion.Header>
                    <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                      <div>
                        <strong>{t('studentCourses.module', { order: module.module_order, title: module.module_title })}</strong>
                        <Badge bg="secondary" className="ms-2">
                          {t('studentCourses.lessonsCount', { count: module.lessons_count || 0 })}
                        </Badge>
                      </div>
                    </div>
                  </Accordion.Header>
                  <Accordion.Body>
                    <div className="mb-3">
                      <p className="text-muted">{module.module_description}</p>
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
                                  <Badge bg="secondary" className="ms-2">{t('studentCourses.durationMinutes', { duration: lesson.duration_minutes })}</Badge>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted">{t('studentCourses.noLessons')}</p>
                    )}
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentCourses;

