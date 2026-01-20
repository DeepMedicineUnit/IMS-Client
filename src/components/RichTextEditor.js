import React, { useRef, useState, useEffect } from 'react';
import { Button, ButtonGroup, Dropdown } from 'react-bootstrap';
import api from '../utils/api';

const RichTextEditor = ({ value, onChange, placeholder = "Nhập nội dung..." }) => {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const isInternalUpdate = useRef(false);

  // Function to detect and convert URLs to clickable links
  const convertUrlsToLinks = (html) => {
    if (!html) return html;
    
    // Create a temporary div to work with
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // URL regex pattern - matches http, https, www, and common domains
    const urlPattern = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+|www\.[^\s<>"{}|\\^`\[\]]+|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.([a-zA-Z]{2,})(\/[^\s<>"{}|\\^`\[\]]*)?)/gi;
    
    // Function to process a text node
    const processTextNode = (textNode) => {
      // Skip if parent is already a link
      if (textNode.parentElement && textNode.parentElement.tagName === 'A') {
        return;
      }
      
      const text = textNode.textContent;
      const matches = [...text.matchAll(urlPattern)];
      
      if (matches.length === 0) return;
      
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      
      matches.forEach(match => {
        // Add text before URL
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
        }
        
        // Create link
        const url = match[0];
        let href = url;
        
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          href = 'https://' + url;
        }
        
        const link = document.createElement('a');
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = url;
        link.className = 'rich-text-link';
        
        fragment.appendChild(link);
        lastIndex = match.index + match[0].length;
      });
      
      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }
      
      // Replace text node with fragment
      if (fragment.childNodes.length > 0) {
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    };
    
    // Get all text nodes using TreeWalker
    const walker = document.createTreeWalker(
      tempDiv,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip if parent is already a link
          if (node.parentElement && node.parentElement.tagName === 'A') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );
    
    // Collect text nodes first (because we'll be modifying the tree)
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    // Process each text node
    textNodes.forEach(processTextNode);
    
    return tempDiv.innerHTML;
  };

  // Debounce function for URL conversion
  const urlConversionTimeoutRef = useRef(null);

  const handleContentChange = () => {
    if (editorRef.current && onChange && !isInternalUpdate.current) {
      const content = editorRef.current.innerHTML;
      onChange(content);
      
      // Debounce URL conversion to avoid interrupting typing
      if (urlConversionTimeoutRef.current) {
        clearTimeout(urlConversionTimeoutRef.current);
      }
      
      urlConversionTimeoutRef.current = setTimeout(() => {
        if (!editorRef.current || isInternalUpdate.current) return;
        
        const currentContent = editorRef.current.innerHTML;
        const contentWithLinks = convertUrlsToLinks(currentContent);
        
        // Only update if URLs were converted
        if (contentWithLinks !== currentContent) {
          isInternalUpdate.current = true;
          
          // Save cursor position
          const selection = window.getSelection();
          let savedOffset = 0;
          let savedContainer = null;
          
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            savedContainer = range.startContainer;
            savedOffset = range.startOffset;
          }
          
          // Update content
          editorRef.current.innerHTML = contentWithLinks;
          
          // Restore cursor position
          if (savedContainer) {
            try {
              // Try to find equivalent position in new content
              const newRange = document.createRange();
              
              // If saved container is still in the tree, use it
              if (editorRef.current.contains(savedContainer) || savedContainer === editorRef.current) {
                newRange.setStart(savedContainer, Math.min(savedOffset, savedContainer.textContent?.length || 0));
                newRange.setEnd(savedContainer, Math.min(savedOffset, savedContainer.textContent?.length || 0));
              } else {
                // Fallback: place cursor at end
                newRange.selectNodeContents(editorRef.current);
                newRange.collapse(false);
              }
              
              selection.removeAllRanges();
              selection.addRange(newRange);
            } catch (err) {
              // If range is invalid, place cursor at end
              const newRange = document.createRange();
              newRange.selectNodeContents(editorRef.current);
              newRange.collapse(false);
              selection.removeAllRanges();
              selection.addRange(newRange);
            }
          }
          
          isInternalUpdate.current = false;
          
          // Notify parent of updated content
          if (onChange) {
            onChange(editorRef.current.innerHTML);
          }
        }
      }, 500); // Wait 500ms after user stops typing
    }
  };

  // Initialize editor content on mount
  useEffect(() => {
    if (editorRef.current && value !== undefined && !editorRef.current.innerHTML) {
      isInternalUpdate.current = true;
      editorRef.current.innerHTML = value || '';
      isInternalUpdate.current = false;
    }
  }, []); // Only run on mount

  // Sync value prop with contentEditable when value changes externally
  useEffect(() => {
    if (editorRef.current && value !== undefined) {
      const currentContent = editorRef.current.innerHTML;
      // Only update if content is different and not from internal change
      if (currentContent !== value && !isInternalUpdate.current) {
        isInternalUpdate.current = true;
        editorRef.current.innerHTML = value || '';
        isInternalUpdate.current = false;
      }
    }
  }, [value]);

  const execCommand = (command, value = null) => {
    if (!editorRef.current) return;
    
    // Ensure editor is focused
    editorRef.current.focus();
    
    // Execute command
    try {
      document.execCommand(command, false, value);
      handleContentChange();
    } catch (err) {
      console.error('Error executing command:', err);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate image
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh không được vượt quá 5MB');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post('/tickets/upload-comment-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        const imageUrl = response.data.data.url || response.data.data.path;
        const img = document.createElement('img');
        img.src = imageUrl.startsWith('http') ? imageUrl : `/api${imageUrl}`;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '10px 0';
        
        // Insert image at cursor position
        if (!editorRef.current) return;
        
        editorRef.current.focus();
        const selection = window.getSelection();
        
        if (selection.rangeCount > 0) {
          try {
            const range = selection.getRangeAt(0);
            // Check if range is within editor
            if (editorRef.current.contains(range.commonAncestorContainer) || 
                range.commonAncestorContainer === editorRef.current) {
              range.deleteContents();
              range.insertNode(img);
              range.setStartAfter(img);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
            } else {
              // Range is outside editor, append to end
              editorRef.current.appendChild(img);
            }
          } catch (err) {
            console.error('Error inserting image:', err);
            // Fallback: append to end
            editorRef.current.appendChild(img);
          }
        } else {
          // No selection, append to end
          editorRef.current.appendChild(img);
        }
        
        handleContentChange();
      } else {
        alert('Không thể upload ảnh: ' + (response.data.message || 'Lỗi không xác định'));
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Không thể upload ảnh. Vui lòng thử lại.');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const insertImage = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="rich-text-editor" style={{ border: '1px solid #ced4da', borderRadius: '4px' }}>
      {/* Toolbar */}
      <div 
        className="d-flex flex-wrap align-items-center gap-1 p-2 border-bottom"
        style={{ backgroundColor: '#f8f9fa', minHeight: '40px' }}
        onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
      >
        <ButtonGroup size="sm">
          <Button
            variant="outline-secondary"
            onClick={() => execCommand('bold')}
            title="Đậm (Ctrl+B)"
          >
            <i className="fas fa-bold"></i>
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => execCommand('italic')}
            title="Nghiêng (Ctrl+I)"
          >
            <i className="fas fa-italic"></i>
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => execCommand('underline')}
            title="Gạch chân (Ctrl+U)"
          >
            <i className="fas fa-underline"></i>
          </Button>
        </ButtonGroup>

        <div className="vr"></div>

        <Dropdown>
          <Dropdown.Toggle variant="outline-secondary" size="sm" id="font-size-dropdown">
            <i className="fas fa-text-height"></i> Kích thước
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => execCommand('fontSize', '1')}>Rất nhỏ</Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('fontSize', '2')}>Nhỏ</Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('fontSize', '3')}>Bình thường</Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('fontSize', '4')}>Lớn</Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('fontSize', '5')}>Rất lớn</Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('fontSize', '6')}>Cực lớn</Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('fontSize', '7')}>Cực kỳ lớn</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <Dropdown>
          <Dropdown.Toggle variant="outline-secondary" size="sm" id="font-family-dropdown">
            <i className="fas fa-font"></i> Font
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => execCommand('fontName', 'Arial')}>Arial</Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('fontName', 'Times New Roman')}>Times New Roman</Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('fontName', 'Courier New')}>Courier New</Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('fontName', 'Verdana')}>Verdana</Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('fontName', 'Georgia')}>Georgia</Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('fontName', 'Comic Sans MS')}>Comic Sans MS</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <div className="vr"></div>

        <Dropdown>
          <Dropdown.Toggle variant="outline-secondary" size="sm" id="text-color-dropdown">
            <i className="fas fa-palette"></i> Màu chữ
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => execCommand('foreColor', '#000000')}>
              <span style={{ color: '#000000' }}>●</span> Đen
            </Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('foreColor', '#FF0000')}>
              <span style={{ color: '#FF0000' }}>●</span> Đỏ
            </Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('foreColor', '#0000FF')}>
              <span style={{ color: '#0000FF' }}>●</span> Xanh dương
            </Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('foreColor', '#008000')}>
              <span style={{ color: '#008000' }}>●</span> Xanh lá
            </Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('foreColor', '#FFA500')}>
              <span style={{ color: '#FFA500' }}>●</span> Cam
            </Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('foreColor', '#800080')}>
              <span style={{ color: '#800080' }}>●</span> Tím
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <Dropdown>
          <Dropdown.Toggle variant="outline-secondary" size="sm" id="bg-color-dropdown">
            <i className="fas fa-highlighter"></i> Màu nền
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => execCommand('backColor', '#FFFF00')}>
              <span style={{ backgroundColor: '#FFFF00', padding: '2px 8px' }}>Vàng</span>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('backColor', '#FFE4B5')}>
              <span style={{ backgroundColor: '#FFE4B5', padding: '2px 8px' }}>Kem</span>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('backColor', '#E6E6FA')}>
              <span style={{ backgroundColor: '#E6E6FA', padding: '2px 8px' }}>Lavender</span>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('backColor', '#90EE90')}>
              <span style={{ backgroundColor: '#90EE90', padding: '2px 8px' }}>Xanh nhạt</span>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('backColor', '#FFB6C1')}>
              <span style={{ backgroundColor: '#FFB6C1', padding: '2px 8px' }}>Hồng nhạt</span>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => execCommand('backColor', '#FFFFFF')}>
              <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #ccc', padding: '2px 8px' }}>Xóa màu nền</span>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <div className="vr"></div>

        <ButtonGroup size="sm">
          <Button
            variant="outline-secondary"
            onClick={() => execCommand('insertUnorderedList')}
            title="Danh sách không đánh số"
          >
            <i className="fas fa-list-ul"></i>
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => execCommand('insertOrderedList')}
            title="Danh sách đánh số"
          >
            <i className="fas fa-list-ol"></i>
          </Button>
        </ButtonGroup>

        <div className="vr"></div>

        <ButtonGroup size="sm">
          <Button
            variant="outline-secondary"
            onClick={() => execCommand('justifyLeft')}
            title="Căn trái"
          >
            <i className="fas fa-align-left"></i>
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => execCommand('justifyCenter')}
            title="Căn giữa"
          >
            <i className="fas fa-align-center"></i>
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => execCommand('justifyRight')}
            title="Căn phải"
          >
            <i className="fas fa-align-right"></i>
          </Button>
        </ButtonGroup>

        <div className="vr"></div>

        <Button
          variant="outline-secondary"
          size="sm"
          onClick={insertImage}
          disabled={uploading}
          title="Chèn ảnh"
        >
          {uploading ? (
            <i className="fas fa-spinner fa-spin"></i>
          ) : (
            <i className="fas fa-image"></i>
          )}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning={true}
        onInput={handleContentChange}
        onPaste={async (e) => {
          e.preventDefault();
          const clipboardData = e.clipboardData || window.clipboardData;
          
          // Check for image in clipboard first
          const items = clipboardData.items;
          let imageFile = null;
          
          if (items && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.indexOf('image') !== -1) {
                imageFile = items[i].getAsFile();
                break;
              }
            }
          }
          
          // If image found, upload it
          if (imageFile) {
            try {
              setUploading(true);
              const formData = new FormData();
              formData.append('image', imageFile);
              
              const response = await api.post('/tickets/upload-comment-image', formData, {
                headers: {
                  'Content-Type': 'multipart/form-data'
                }
              });
              
              if (response.data.success) {
                const imageUrl = response.data.data.url || response.data.data.path;
                const img = document.createElement('img');
                img.src = imageUrl.startsWith('http') ? imageUrl : `/api${imageUrl}`;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
                img.style.margin = '10px 0';
                
                // Insert image at cursor position
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                  try {
                    const range = selection.getRangeAt(0);
                    if (editorRef.current.contains(range.commonAncestorContainer) || 
                        range.commonAncestorContainer === editorRef.current) {
                      range.deleteContents();
                      range.insertNode(img);
                      range.setStartAfter(img);
                      range.collapse(true);
                      selection.removeAllRanges();
                      selection.addRange(range);
                    } else {
                      editorRef.current.appendChild(img);
                    }
                  } catch (err) {
                    console.error('Error inserting pasted image:', err);
                    editorRef.current.appendChild(img);
                  }
                } else {
                  editorRef.current.appendChild(img);
                }
                
                handleContentChange();
              } else {
                alert('Không thể upload ảnh: ' + (response.data.message || 'Lỗi không xác định'));
              }
            } catch (error) {
              console.error('Error uploading pasted image:', error);
              alert('Không thể upload ảnh. Vui lòng thử lại.');
            } finally {
              setUploading(false);
            }
            return;
          }
          
          // If no image, handle text/HTML paste
          let pastedContent = clipboardData.getData('text/html');
          
          if (!pastedContent) {
            // If no HTML, get plain text
            pastedContent = clipboardData.getData('text/plain');
            if (pastedContent) {
              // Convert plain text to HTML (preserve line breaks)
              pastedContent = pastedContent.replace(/\n/g, '<br>');
            }
          }
          
          if (pastedContent) {
            // Insert HTML at cursor position
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.deleteContents();
              
              // Create a temporary div to parse HTML
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = pastedContent;
              
              // Insert nodes
              const fragment = document.createDocumentFragment();
              while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
              }
              
              range.insertNode(fragment);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
            } else {
              // Fallback: append to end
              editorRef.current.innerHTML += pastedContent;
            }
            
            handleContentChange();
          }
        }}
        style={{
          minHeight: '150px',
          maxHeight: '400px',
          overflowY: 'auto',
          padding: '12px',
          outline: 'none',
          fontSize: '14px',
          lineHeight: '1.5',
          fontFamily: 'Arial, sans-serif',
          cursor: 'text',
          userSelect: 'text',
          WebkitUserSelect: 'text'
        }}
        data-placeholder={placeholder}
        onFocus={(e) => {
          // Ensure cursor is text cursor, not loading
          if (editorRef.current) {
            editorRef.current.style.cursor = 'text';
          }
          
          // If editor is empty, place cursor at start without selecting
          setTimeout(() => {
            if (editorRef.current) {
              const selection = window.getSelection();
              const range = document.createRange();
              
              // If empty or only has placeholder-like content
              if (!editorRef.current.textContent || editorRef.current.textContent.trim() === '') {
                range.setStart(editorRef.current, 0);
                range.setEnd(editorRef.current, 0);
              } else {
                // If has content, just ensure cursor is visible
                if (selection.rangeCount === 0) {
                  range.setStart(editorRef.current, 0);
                  range.setEnd(editorRef.current, 0);
                } else {
                  // Collapse selection to cursor
                  const currentRange = selection.getRangeAt(0);
                  currentRange.collapse(true);
                  range.setStart(currentRange.startContainer, currentRange.startOffset);
                  range.setEnd(currentRange.startContainer, currentRange.startOffset);
                }
              }
              
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }, 0);
        }}
        onMouseDown={(e) => {
          // Ensure cursor is text on mouse down
          if (editorRef.current) {
            editorRef.current.style.cursor = 'text';
          }
        }}
        onClick={(e) => {
          // Ensure cursor is text cursor, not loading
          if (editorRef.current) {
            editorRef.current.style.cursor = 'text';
          }
        }}
      />
      
      <style>{`
        .rich-text-editor [contenteditable] {
          cursor: text !important;
          user-select: text;
          -webkit-user-select: text;
        }
        .rich-text-editor [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #6c757d;
          font-style: italic;
          pointer-events: none;
        }
        .rich-text-editor [contenteditable]:focus {
          outline: none;
          cursor: text !important;
        }
        .rich-text-editor [contenteditable]:focus:empty:before {
          color: #6c757d;
        }
        .rich-text-editor img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 10px 0;
          cursor: pointer;
        }
        .rich-text-editor [contenteditable] * {
          cursor: inherit;
        }
        .rich-text-editor .rich-text-link {
          color: #0066cc !important;
          text-decoration: underline !important;
          cursor: pointer !important;
        }
        .rich-text-editor .rich-text-link:hover {
          color: #0052a3 !important;
          text-decoration: underline !important;
        }
        .rich-text-editor .rich-text-link:visited {
          color: #551a8b !important;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;

