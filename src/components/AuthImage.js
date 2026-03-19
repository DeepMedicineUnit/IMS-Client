/**
 * Hiển thị ảnh từ API có xác thực (token).
 * <img> thông thường không gửi Authorization header nên ảnh bị 401.
 * Component này fetch với api (có token) rồi hiển thị qua blob URL.
 */
import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

export default function AuthImage({ src, alt = '', className, style, onImageClick, ...rest }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef(null);

  // Giữ ảnh cũ cho đến khi ảnh mới tải xong → tránh chớp khi cột Live Webcam cập nhật
  useEffect(() => {
    if (!src) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setBlobUrl(null);
      setError(false);
      return;
    }
    setError(false);
    const apiBase = (typeof api !== 'undefined' && api.defaults?.baseURL) ? api.defaults.baseURL.replace(/\/api\/?$/, '') : '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let url = src.startsWith('http') ? src : (apiBase || origin) + (src.startsWith('/') ? src : '/' + src);
    url = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    let cancelled = false;
    api.get(url, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        const blob = res.data;
        if (blob && blob.size > 0) {
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          const objectUrl = URL.createObjectURL(blob);
          blobUrlRef.current = objectUrl;
          setBlobUrl(objectUrl);
        } else {
          setBlobUrl(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBlobUrl(null);
          setError(true);
        }
      });
    return () => {
      cancelled = true;
      // Không revoke/set null ở đây để ảnh cũ vẫn hiển thị đến khi ảnh mới load xong (tránh chớp)
    };
  }, [src]);

  // Khi unmount: revoke blob để tránh rò rỉ bộ nhớ
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  if (error) return null;
  if (!blobUrl) return null;
  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      style={{ ...style, cursor: onImageClick ? 'pointer' : undefined }}
      onClick={onImageClick ? (e) => { e.stopPropagation(); onImageClick(blobUrl); } : undefined}
      role={onImageClick ? 'button' : undefined}
      {...rest}
    />
  );
}
