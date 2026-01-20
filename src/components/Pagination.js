import React from 'react';
import './Pagination.css';

const Pagination = ({ 
  currentPage = 1, 
  totalPages = 1, 
  onPageChange,
  maxVisiblePages = 5,
  showFirstLast = true 
}) => {
  if (totalPages <= 1) return null;

  // Calculate visible page numbers
  const getVisiblePages = () => {
    const pages = [];
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  const visiblePages = getVisiblePages();
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;
  const startPage = visiblePages[0] || 1;
  const endPage = visiblePages[visiblePages.length - 1] || totalPages;

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage && onPageChange) {
      onPageChange(page);
    }
  };

  return (
    <div className="pagination-wrapper">
      <div className="pagination-container">
        <ul className="pagination-list">
          {/* Previous button */}
          <li>
            <button
              type="button"
              className={`pagination-button ${isFirstPage ? 'disabled' : ''}`}
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={isFirstPage}
              aria-label="Previous page"
            >
              <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M17.5 9.8125H4.15625L9.46875 4.40625C9.75 4.125 9.75 3.6875 9.46875 3.40625C9.1875 3.125 8.75 3.125 8.46875 3.40625L2 9.96875C1.71875 10.25 1.71875 10.6875 2 10.9688L8.46875 17.5312C8.59375 17.6562 8.78125 17.75 8.96875 17.75C9.15625 17.75 9.3125 17.6875 9.46875 17.5625C9.75 17.2812 9.75 16.8438 9.46875 16.5625L4.1875 11.2188H17.5C17.875 11.2188 18.1875 10.9062 18.1875 10.5312C18.1875 10.125 17.875 9.8125 17.5 9.8125Z"
                  fill="currentColor" 
                />
              </svg>
            </button>
          </li>

          {/* First page */}
          {showFirstLast && startPage > 1 && (
            <>
              <li>
                <button
                  type="button"
                  className="pagination-button"
                  onClick={() => handlePageChange(1)}
                  aria-label="Go to page 1"
                >
                  1
                </button>
              </li>
              {startPage > 2 && (
                <li className="pagination-ellipsis">
                  <span>...</span>
                </li>
              )}
            </>
          )}

          {/* Visible page numbers */}
          {visiblePages.map((page) => (
            <li key={page}>
              <button
                type="button"
                className={`pagination-button ${page === currentPage ? 'active' : ''}`}
                onClick={() => handlePageChange(page)}
                aria-label={`Go to page ${page}`}
                aria-current={page === currentPage ? 'page' : null}
              >
                {page}
              </button>
            </li>
          ))}

          {/* Last page */}
          {showFirstLast && endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && (
                <li className="pagination-ellipsis">
                  <span>...</span>
                </li>
              )}
              <li>
                <button
                  type="button"
                  className="pagination-button"
                  onClick={() => handlePageChange(totalPages)}
                  aria-label={`Go to page ${totalPages}`}
                >
                  {totalPages}
                </button>
              </li>
            </>
          )}

          {/* Next button */}
          <li>
            <button
              type="button"
              className={`pagination-button ${isLastPage ? 'disabled' : ''}`}
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={isLastPage}
              aria-label="Next page"
            >
              <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M18 10L11.5312 3.4375C11.25 3.15625 10.8125 3.15625 10.5312 3.4375C10.25 3.71875 10.25 4.15625 10.5312 4.4375L15.7812 9.78125H2.5C2.125 9.78125 1.8125 10.0937 1.8125 10.4688C1.8125 10.8438 2.125 11.1875 2.5 11.1875H15.8437L10.5312 16.5938C10.25 16.875 10.25 17.3125 10.5312 17.5938C10.6562 17.7188 10.8437 17.7812 11.0312 17.7812C11.2187 17.7812 11.4062 17.7188 11.5312 17.5625L18 11C18.2812 10.7187 18.2812 10.2812 18 10Z"
                  fill="currentColor" 
                />
              </svg>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Pagination;

