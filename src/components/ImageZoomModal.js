import React, { useState, useEffect, useRef } from 'react';
import './ImageZoomModal.css';

/**
 * Modal phóng to ảnh dùng chung: cuộn chuột thu phóng, giữ chuột trái kéo di chuyển, click nền/Esc đóng.
 * @param {boolean} isOpen - Hiển thị modal khi true
 * @param {string} imageUrl - URL ảnh (data URL hoặc URL thường)
 * @param {function} onClose - Gọi khi đóng (click nền, Esc, hoặc nút đóng)
 * @param {string} [downloadFileName] - Tên file khi tải về (mặc định: image.png)
 * @param {boolean} [preserveZoomOnUrlChange] - Khi true (vd. live webcam), không reset zoom/pan khi đổi ảnh, chỉ reset khi mở modal
 */
const ImageZoomModal = ({ isOpen, imageUrl, onClose, downloadFileName = 'image.png', preserveZoomOnUrlChange = false }) => {
    const [zoomScale, setZoomScale] = useState(1);
    const [zoomPan, setZoomPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const zoomContainerRef = useRef(null);
    const zoomPanStartRef = useRef({ x: 0, y: 0 });
    const zoomPanOffsetRef = useRef({ x: 0, y: 0 });
    const wasOpenWithImageRef = useRef(false);

    // Reset zoom/pan khi mở ảnh mới (khi preserveZoomOnUrlChange: chỉ reset lúc mở modal, không reset khi đổi ảnh live)
    useEffect(() => {
        if (isOpen && imageUrl) {
            if (!preserveZoomOnUrlChange) {
                setZoomScale(1);
                setZoomPan({ x: 0, y: 0 });
            } else if (!wasOpenWithImageRef.current) {
                setZoomScale(1);
                setZoomPan({ x: 0, y: 0 });
                wasOpenWithImageRef.current = true;
            }
        } else {
            wasOpenWithImageRef.current = false;
        }
    }, [isOpen, imageUrl, preserveZoomOnUrlChange]);

    // Cuộn chuột: thu phóng
    useEffect(() => {
        if (!isOpen || !imageUrl || !zoomContainerRef.current) return;
        const el = zoomContainerRef.current;
        const onWheel = (e) => {
            e.preventDefault();
            setZoomScale((s) => Math.min(5, Math.max(0.3, s - e.deltaY * 0.002)));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [isOpen, imageUrl]);

    // Phím Esc: đóng (dùng capture + stopPropagation để modal cha như "Chi tiết câu hỏi đã làm" không bị đóng theo)
    useEffect(() => {
        if (!isOpen || !imageUrl) return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose?.();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [isOpen, imageUrl, onClose]);

    // Kéo chuột: pan
    useEffect(() => {
        if (!isPanning) return;
        const onMove = (e) => {
            setZoomPan({
                x: zoomPanOffsetRef.current.x + (e.clientX - zoomPanStartRef.current.x),
                y: zoomPanOffsetRef.current.y + (e.clientY - zoomPanStartRef.current.y),
            });
        };
        const onUp = () => setIsPanning(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [isPanning]);

    // Lắng nghe thoát fullscreen (nút Esc của trình duyệt hoặc F11)
    useEffect(() => {
        if (!isOpen) return;
        const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, [isOpen]);

    const toggleFullscreen = () => {
        if (!zoomContainerRef.current) return;
        if (!document.fullscreenElement) {
            zoomContainerRef.current.requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.();
        }
    };

    const handleDownload = async (e) => {
        e.stopPropagation();
        try {
            const isDataUrl = typeof imageUrl === 'string' && imageUrl.startsWith('data:');
            let href = imageUrl;
            let blobUrlToRevoke = null;
            if (!isDataUrl) {
                const res = await fetch(imageUrl);
                if (!res.ok) throw new Error('Fetch failed');
                const blob = await res.blob();
                blobUrlToRevoke = URL.createObjectURL(blob);
                href = blobUrlToRevoke;
            }
            const a = document.createElement('a');
            a.href = href;
            a.download = downloadFileName;
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            if (blobUrlToRevoke) URL.revokeObjectURL(blobUrlToRevoke);
        } catch (_) {}
    };

    if (!isOpen || !imageUrl) return null;

    return (
        <div
            ref={zoomContainerRef}
            className="image-zoom-modal"
            role="button"
            tabIndex={0}
            style={{ cursor: isPanning ? 'grabbing' : 'zoom-out' }}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    e.stopPropagation();
                    onClose?.();
                }
            }}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    onClose?.();
                }
            }}
        >
            <div
                className="image-zoom-modal__content"
                style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    zoomPanStartRef.current = { x: e.clientX, y: e.clientY };
                    zoomPanOffsetRef.current = { x: zoomPan.x, y: zoomPan.y };
                    setIsPanning(true);
                }}
            >
                <img
                    src={imageUrl}
                    alt=""
                    className="image-zoom-modal__img"
                    style={{
                        transform: `translate(${zoomPan.x}px, ${zoomPan.y}px) scale(${zoomScale})`,
                    }}
                    draggable={false}
                />
            </div>
            <div
                className="image-zoom-modal__footer"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose?.();
                }}
                role="button"
            >
                <span className="image-zoom-modal__footer-spacer" aria-hidden="true" />
                <span className="image-zoom-modal__footer-hint">
                    <i className="fas fa-mouse-pointer me-1"></i> Cuộn chuột: thu phóng
                    <span className="mx-2">•</span>
                    <i className="fas fa-arrows-alt me-1"></i> Giữ chuột trái: di chuyển ảnh
                    <span className="mx-2">•</span>
                    <i className="fas fa-times-circle me-1"></i> Click nền hoặc Esc: đóng
                </span>
                <span className="image-zoom-modal__footer-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        className="image-zoom-modal__btn"
                        onClick={handleDownload}
                        title="Tải ảnh về máy"
                        aria-label="Tải về"
                    >
                        <i className="fas fa-download"></i>
                    </button>
                    <button
                        type="button"
                        className="image-zoom-modal__btn"
                        onClick={toggleFullscreen}
                        title={isFullscreen ? 'Thoát toàn màn hình' : 'Phóng to toàn màn hình'}
                        aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
                    >
                        <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
                    </button>
                    <button
                        type="button"
                        className="image-zoom-modal__btn"
                        onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                        title="Đóng"
                        aria-label="Đóng"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </span>
            </div>
        </div>
    );
};

export default ImageZoomModal;
