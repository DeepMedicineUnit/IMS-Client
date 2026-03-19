import React, { useState, useEffect, useRef } from 'react';
import { Button, Form, Alert, Spinner, Badge } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';

// PDF.js: chuyển PDF thành ảnh để nhận diện (worker dùng CDN)
let pdfjsLib = null;
const initPdfJs = () => {
    if (pdfjsLib) return pdfjsLib;
    try {
        pdfjsLib = require('pdfjs-dist');
        const version = pdfjsLib.version || '4.8.69';
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
        return pdfjsLib;
    } catch (_) {
        return null;
    }
};

/** Chuyển file PDF thành mảng { file, dataUrl } (mỗi trang = 1 ảnh) */
const pdfFileToImageItems = async (file) => {
    const lib = initPdfJs();
    if (!lib) throw new Error('Không thể tải thư viện PDF. Vui lòng tải lại trang.');
    const data = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsArrayBuffer(file);
    });
    const doc = await lib.getDocument({ data }).promise;
    const numPages = doc.numPages;
    const scale = 2;
    const items = [];
    for (let i = 1; i <= numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const baseName = file.name.replace(/\.pdf$/i, '') || 'document';
        const blob = await (await fetch(dataUrl)).blob();
        const pageFile = new File([blob], `${baseName}_trang_${i}.jpg`, { type: 'image/jpeg' });
        items.push({ file: pageFile, dataUrl });
    }
    return items;
};

const DOTLOTTIE_SCRIPT = 'https://unpkg.com/@lottiefiles/dotlottie-wc@0.8.5/dist/dotlottie-wc.js';
const ensureDotlottie = () => {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`script[src="${DOTLOTTIE_SCRIPT}"]`)) return;
  const s = document.createElement('script');
  s.type = 'module';
  s.src = DOTLOTTIE_SCRIPT;
  document.head.appendChild(s);
};
import { useAuth } from '../../contexts/AuthContext';
import ImageZoomModal from '../../components/ImageZoomModal';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';
import '../../styles/user.css';

const ScoreCapturePage = () => {
    usePageTitle('Chụp ảnh nhận diện điểm');
    const { id } = useParams();
    const navigate = useNavigate();
    const { api: authApi } = useAuth();
    const [list, setList] = useState(null);
    const [apiKeys, setApiKeys] = useState([]);
    const [selectedKeyId, setSelectedKeyId] = useState('');
    const [capturedImage, setCapturedImage] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState(null);
    const [stream, setStream] = useState(null);
    const [multiPreviewList, setMultiPreviewList] = useState([]); // [{ file, dataUrl }]
    const [multiProcessing, setMultiProcessing] = useState(false);
    const [multiProgress, setMultiProgress] = useState({ current: 0, total: 0 });
    const [multiAggregated, setMultiAggregated] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [pdfConverting, setPdfConverting] = useState(false);
    const [zoomedImageUrl, setZoomedImageUrl] = useState(null);
    const abortMultiRef = useRef(false);
    const videoRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => { ensureDotlottie(); }, []);
    useEffect(() => {
        loadList();
        loadApiKeys();
        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [id]);

    const loadList = async () => {
        try {
            const res = await authApi.get(`/score-scanning/lists/${id}`);
            setList(res.data);
        } catch (_) {}
    };

    const loadApiKeys = async () => {
        try {
            const res = await authApi.get('/score-scanning/gemini-keys');
            setApiKeys(res.data.keys || []);
        } catch (_) {}
    };

    const startCamera = async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            setStream(s);
            if (videoRef.current) {
                videoRef.current.srcObject = s;
            }
            setCapturedImage(null);
            setResult(null);
        } catch (err) {
            alert('Không thể truy cập camera. Vui lòng chọn ảnh từ thư viện.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            setStream(null);
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setCapturedImage(dataUrl);
        stopCamera();
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target?.files || e.dataTransfer?.files || []);
        const images = files.filter(f => f.type.startsWith('image/'));
        const pdfs = files.filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''));
        if (images.length === 0 && pdfs.length === 0) return;

        const allItems = []; // [{ file, dataUrl }]

        const addImageFile = (file) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    allItems.push({ file, dataUrl: reader.result });
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        };

        if (pdfs.length > 0) {
            setPdfConverting(true);
            try {
                for (const pdfFile of pdfs) {
                    const items = await pdfFileToImageItems(pdfFile);
                    allItems.push(...items);
                }
            } catch (err) {
                alert(err.message || 'Không thể đọc file PDF.');
                setPdfConverting(false);
                if (e.target?.value) e.target.value = '';
                return;
            }
            setPdfConverting(false);
        }

        for (const file of images) {
            await addImageFile(file);
        }

        const total = allItems.length;
        const quota = availableKeys.reduce((s, k) => s + (k.remaining || 0), 0);
        if (total > quota) {
            alert(`Chỉ còn ${quota} lượt quét hôm nay. Vui lòng chọn tối đa ${quota} ảnh/trang.`);
            if (e.target?.value) e.target.value = '';
            return;
        }

        setMultiAggregated(null);
        if (total === 1) {
            setCapturedImage(allItems[0].dataUrl);
            setResult(null);
        } else {
            setMultiPreviewList(allItems);
        }
        if (e.target?.value) e.target.value = '';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFileSelect(e);
    };

    const retake = () => {
        setCapturedImage(null);
        setResult(null);
        startCamera();
    };

    const processImage = async () => {
        if (!capturedImage) return;
        try {
            setProcessing(true);
            setResult(null);
            const payload = { image: capturedImage };
            if (selectedKeyId) payload.apiKeyId = parseInt(selectedKeyId);
            const res = await authApi.post(`/score-scanning/lists/${id}/scan`, payload, { timeout: 120000 });
            setResult(res.data);
            loadApiKeys();
        } catch (err) {
            const msg = err.response?.data?.message || (err.code === 'ECONNABORTED' || (err.message && err.message.includes('timeout'))
                ? 'Request quá lâu, có thể bị timeout. Nếu dữ liệu đã được lưu, hãy nhấn "Quay lại" để xem danh sách.'
                : 'Có lỗi xảy ra');
            setResult({ error: msg });
        } finally {
            setProcessing(false);
        }
    };

    const resolveConflict = async (index, action) => {
        const conflict = result.conflicts[index];
        if (!conflict) return;
        try {
            const res = await authApi.post(`/score-scanning/lists/${id}/resolve-conflict`, { action, studentData: conflict });
            const newConflicts = [...result.conflicts];
            newConflicts.splice(index, 1);
            setResult({ ...result, conflicts: newConflicts, message: res.data.message });
            if (newConflicts.length === 0) {
                setTimeout(() => navigate(`/score-scanning/lists/${id}`), 1500);
            }
        } catch (_) {}
    };

    const availableKeys = apiKeys.filter(k => k.is_active && k.remaining > 0);
    const totalRemainingQuota = availableKeys.reduce((s, k) => s + (k.remaining || 0), 0);

    const processMultiFiles = async (items) => {
        if (!items || items.length === 0) return;
        abortMultiRef.current = false;
        setMultiProcessing(true);
        setMultiProgress({ current: 0, total: items.length });
        const aggregated = { added: [], updated: [], conflicts: [], skipped: [], raw_data: [], errors: [] };
        for (let i = 0; i < items.length; i++) {
            if (abortMultiRef.current) break;
            setMultiProgress({ current: i + 1, total: items.length });
            const item = items[i];
            const dataUrl = item.dataUrl != null ? item.dataUrl : await new Promise((resolve) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.readAsDataURL(item.file);
            });
            const fileName = item.file?.name || `Ảnh ${i + 1}`;
            try {
                const payload = { image: dataUrl };
                if (selectedKeyId) payload.apiKeyId = parseInt(selectedKeyId);
                const res = await authApi.post(`/score-scanning/lists/${id}/scan`, payload, { timeout: 120000 });
                if (res.data.added) aggregated.added.push(...res.data.added);
                if (res.data.updated) aggregated.updated.push(...res.data.updated);
                if (res.data.conflicts) aggregated.conflicts.push(...res.data.conflicts);
                if (res.data.skipped) aggregated.skipped.push(...res.data.skipped);
                if (res.data.raw_data) aggregated.raw_data.push(...res.data.raw_data);
            } catch (err) {
                aggregated.errors.push({ file: fileName, message: err.response?.data?.message || err.message });
            }
        }
        setMultiAggregated(aggregated);
        setMultiProcessing(false);
        loadApiKeys();
    };

    const resetMultiResult = () => {
        setMultiAggregated(null);
        setMultiPreviewList([]);
    };

    const confirmMultiProcess = () => {
        if (multiPreviewList.length === 0) return;
        processMultiFiles(multiPreviewList);
    };

    const resolveMultiConflict = async (index, action) => {
        const conflict = multiAggregated?.conflicts?.[index];
        if (!conflict) return;
        try {
            const res = await authApi.post(`/score-scanning/lists/${id}/resolve-conflict`, { action, studentData: conflict });
            const newConflicts = [...multiAggregated.conflicts];
            newConflicts.splice(index, 1);
            setMultiAggregated(prev => ({ ...prev, conflicts: newConflicts, message: res.data.message }));
        } catch (_) {}
    };

    return (
        <div>
            {/* Header Section */}
            <div className="session-header">
                <div className="header-content">
                    <div className="header-title">
                        <h1 className="mb-0">Chụp ảnh nhận diện</h1>
                        <p className="header-subtitle mb-0">{list?.name || 'Đang tải...'} – Chụp hoặc tải ảnh bảng điểm để AI nhận diện</p>
                    </div>
                    <div className="header-actions">
                        <Button
                            variant="outline-light"
                            className="create-session-btn"
                            onClick={() => navigate(`/score-scanning/lists/${id}`)}
                        >
                            <i className="fas fa-arrow-left"></i>
                            Quay lại
                        </Button>
                    </div>
                </div>
            </div>

            {/* Instruction Card */}
            <div className="session-card mb-4">
                <div className="card-header-modern">
                    <div className="header-icon">
                        <i className="fas fa-lightbulb"></i>
                    </div>
                    <h6 className="mb-0">Hướng dẫn</h6>
                </div>
                <div className="card-body-modern">
                    <ul className="mb-0">
                        <li>Chụp ảnh rõ bảng điểm với các cột: Mã SV, Họ tên, ĐGCB, KTTX, KTGK, T1</li>
                        <li>Đảm bảo đủ ánh sáng, không bị mờ hoặc nghiêng quá nhiều</li>
                        <li>Có thể kéo thả hoặc chọn ảnh / file PDF (PDF sẽ được chuyển từng trang thành ảnh để nhận diện), nhiều file cùng lúc (hệ thống kiểm tra quota tự động)</li>
                        <li>AI sẽ tự động nhận diện và thêm vào danh sách</li>
                    </ul>
                </div>
            </div>

            {/* Camera / Preview area */}
            <div className="session-card mb-4">
                <div className="card-header-modern d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div className="d-flex align-items-center">
                        <div className="header-icon">
                            <i className="fas fa-camera"></i>
                        </div>
                        <h6 className="mb-0">Chụp ảnh / Xem trước</h6>
                    </div>
                    {apiKeys.length > 0 && (
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <select
                                className="filter-select"
                                value={selectedKeyId}
                                onChange={e => setSelectedKeyId(e.target.value)}
                                style={{ maxWidth: 280, minWidth: 180 }}
                            >
                                <option value="">Tự động chọn key khả dụng</option>
                                {apiKeys.map(k => (
                                    <option key={k.id} value={k.id} disabled={!k.is_active || k.remaining <= 0}>
                                        {k.gmail} - Còn {k.remaining}/{k.daily_limit}
                                    </option>
                                ))}
                            </select>
                            <Button variant="outline-secondary" size="sm" className="filter-btn" onClick={loadApiKeys}>
                                <i className="fas fa-sync"></i> Làm mới
                            </Button>
                        </div>
                    )}
                </div>
                <div className="card-body-modern">
                    {apiKeys.length > 0 && availableKeys.length === 0 && (
                        <Alert variant="warning" className="mb-3">Tất cả API key đã hết quota hoặc bị tắt</Alert>
                    )}
                    <div className="score-capture-viewport">
                        {processing && (
                            <div className="score-capture-processing-overlay">
                                <dotlottie-wc
                                    src={`${process.env.PUBLIC_URL || ''}/icon_animation_lottie/scanner.lottie`}
                                    autoplay
                                    loop
                                    style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                />
                            </div>
                        )}
                        {!capturedImage ? (
                            <>
                                <video ref={videoRef} autoPlay playsInline muted className="score-capture-media" />
                                {!stream && (
                                    <div
                                        className={`score-capture-placeholder ${isDragging ? 'score-capture-placeholder-dragging' : ''}`}
                                        onClick={(e) => { if (!multiProcessing && !multiAggregated && multiPreviewList.length === 0 && !pdfConverting && !e.target.closest('button')) fileInputRef.current?.click(); }}
                                        onDragOver={handleDragOver}
                                        onDragEnter={() => setIsDragging(true)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        {multiPreviewList.length > 0 && !multiAggregated ? (
                                            <div className="w-100" style={{ maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
                                                <div className="row g-2 mb-3">
                                                    {multiPreviewList.map((item, idx) => (
                                                        <div key={idx} className="col-4 position-relative">
                                                            <div className="position-relative rounded overflow-hidden bg-dark" style={{ aspectRatio: '4/3', cursor: 'pointer' }}>
                                                                <img
                                                                    src={item.dataUrl}
                                                                    alt=""
                                                                    className="w-100 h-100"
                                                                    style={{ objectFit: 'cover' }}
                                                                    onClick={(e) => { e.stopPropagation(); setZoomedImageUrl(item.dataUrl); }}
                                                                />
                                                                {multiProcessing && multiProgress.current === idx + 1 && (
                                                                    <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                                                                        <dotlottie-wc
                                                                            src={`${process.env.PUBLIC_URL || ''}/icon_animation_lottie/scanner.lottie`}
                                                                            autoplay loop
                                                                            style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
                                                                        />
                                                                    </div>
                                                                )}
                                                                {multiProcessing && multiProgress.current > idx + 1 && (
                                                                    <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
                                                                        <i className="fas fa-check-circle text-success fa-2x" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <small className="text-muted d-block text-center mt-1">{multiProcessing ? `Ảnh ${idx + 1}/${multiPreviewList.length}` : item.file?.name}</small>
                                                        </div>
                                                    ))}
                                                </div>
                                                {!multiProcessing ? (
                                                    <div className="d-flex gap-2 justify-content-center flex-wrap">
                                                        <Button variant="outline-secondary" size="sm" onClick={() => setMultiPreviewList([])}>Chụp lại</Button>
                                                        <Button variant="success" size="sm" onClick={confirmMultiProcess}>
                                                            <i className="fas fa-check me-1"></i>Xác nhận
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <p className="text-muted small text-center mb-2">Đang nhận diện ảnh {multiProgress.current}/{multiProgress.total}...</p>
                                                )}
                                                {multiProcessing && (
                                                    <Button variant="outline-danger" size="sm" className="d-block mx-auto" onClick={() => { abortMultiRef.current = true; }}>Hủy</Button>
                                                )}
                                            </div>
                                        ) : multiAggregated ? (
                                            <div className="text-start w-100" onClick={e => e.stopPropagation()}>
                                                {multiAggregated.errors?.length > 0 && (
                                                    <Alert variant="danger" className="mb-3">
                                                        <strong>Lỗi:</strong>
                                                        <ul className="mb-0 mt-1">
                                                            {multiAggregated.errors.map((err, i) => (
                                                                <li key={i}>{err.file}: {err.message}</li>
                                                            ))}
                                                        </ul>
                                                    </Alert>
                                                )}
                                                <Alert variant="info" className="mb-3">
                                                    Đã thêm {multiAggregated.added?.length || 0} sinh viên mới, cập nhật {multiAggregated.updated?.length || 0} sinh viên
                                                    {multiAggregated.conflicts?.length > 0 && `, ${multiAggregated.conflicts.length} cần xử lý xung đột`}
                                                </Alert>
                                                {multiAggregated.conflicts?.length > 0 ? (
                                                    <div className="table-responsive mb-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                        <table className="table table-sm">
                                                            <thead><tr><th>Mã SV</th><th>Điểm hiện tại</th><th>Điểm mới</th><th>Thao tác</th></tr></thead>
                                                            <tbody>
                                                                {multiAggregated.conflicts.map((c, i) => (
                                                                    <tr key={i} className="table-warning">
                                                                        <td>{c.ma_sv} - {c.name}</td>
                                                                        <td>ĐGCB:{c.existing?.c2} KTTX:{c.existing?.b1} KTGK:{c.existing?.k1} T1:{c.existing?.t1}</td>
                                                                        <td>ĐGCB:{c.c2} KTTX:{c.b1} KTGK:{c.k1} T1:{c.t1}</td>
                                                                        <td>
                                                                            <Button size="sm" variant="success" className="me-1" onClick={() => resolveMultiConflict(i, 'add')}>Cập nhật</Button>
                                                                            <Button size="sm" variant="secondary" onClick={() => resolveMultiConflict(i, 'skip')}>Bỏ qua</Button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : null}
                                                <div className="d-flex gap-2 flex-wrap">
                                                    <Button variant="primary" size="sm" onClick={() => { resetMultiResult(); navigate(`/score-scanning/lists/${id}`); }}>Về danh sách</Button>
                                                    <Button variant="outline-secondary" size="sm" onClick={resetMultiResult}>Chọn ảnh khác</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {pdfConverting ? (
                                                    <>
                                                        <Spinner animation="border" size="sm" className="me-2" />
                                                        <p className="text-muted mb-0">Đang chuyển PDF thành ảnh...</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-camera fa-3x mb-3 text-primary"></i>
                                                        <p className="text-muted mb-2">Kéo thả ảnh hoặc file PDF vào đây, hoặc nhấn để chọn (nhiều ảnh/PDF)</p>
                                                        <p className="text-muted small mb-3">PDF sẽ được chuyển từng trang thành ảnh để nhận diện. Hoặc nhấn "Bật camera" để chụp trực tiếp.</p>
                                                        <div className="d-flex gap-2 flex-wrap justify-content-center" onClick={e => e.stopPropagation()}>
                                                            <Button variant="primary" className="filter-btn" onClick={startCamera}>
                                                                <i className="fas fa-video me-1"></i>Bật camera
                                                            </Button>
                                                            <Button variant="outline-primary" className="filter-btn" onClick={() => fileInputRef.current?.click()}>
                                                                <i className="fas fa-image me-1"></i>Chọn ảnh / PDF
                                                            </Button>
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                                {stream && (
                                    <div className="score-capture-actions">
                                        <Button variant="success" size="lg" className="score-capture-btn-circle" onClick={capturePhoto}>
                                            <i className="fas fa-camera"></i>
                                        </Button>
                                        <Button variant="outline-secondary" className="filter-btn" onClick={() => { stopCamera(); setStream(null); }}>Hủy</Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <img
                                    src={capturedImage}
                                    alt="Preview"
                                    className="score-capture-media"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setZoomedImageUrl(capturedImage)}
                                />
                                <div className="score-capture-actions">
                                    <Button variant="warning" className="filter-btn" onClick={retake} disabled={processing}>
                                        <i className="fas fa-redo me-1"></i>Chụp lại
                                    </Button>
                                    <Button variant="success" className="filter-btn" onClick={processImage} disabled={processing}>
                                        {processing ? <><Spinner size="sm" animation="border" /> Đang nhận diện...</> : <><i className="fas fa-check me-1"></i>Xác nhận</>}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                    <input type="file" ref={fileInputRef} accept="image/*,.pdf,application/pdf" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
                </div>
            </div>

            {/* Result */}
            {result && (
                <div className="session-card">
                    <div className="card-header-modern">
                        <div className="header-icon">
                            <i className="fas fa-check-circle text-success"></i>
                        </div>
                        <h6 className="mb-0">Kết quả nhận diện</h6>
                    </div>
                    <div className="card-body-modern">
                        {result.error ? (
                            <Alert variant="danger">{result.error}</Alert>
                        ) : (
                            <>
                                <Alert variant="info">{result.message}</Alert>
                                {result.conflicts && result.conflicts.length > 0 ? (
                                    <div className="session-table-container">
                                        <div className="table-responsive-mobile">
                                            <table className="table session-table students-table">
                                                <thead>
                                                    <tr>
                                                        <th>Mã SV</th>
                                                        <th>Điểm hiện tại</th>
                                                        <th>Điểm mới</th>
                                                        <th>Thao tác</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {result.conflicts.map((c, i) => (
                                                        <tr key={i} className="table-warning">
                                                            <td>{c.ma_sv} - {c.name}</td>
                                                            <td>ĐGCB:{c.existing?.c2} KTTX:{c.existing?.b1} KTGK:{c.existing?.k1} T1:{c.existing?.t1}</td>
                                                            <td>ĐGCB:{c.c2} KTTX:{c.b1} KTGK:{c.k1} T1:{c.t1}</td>
                                                            <td>
                                                                <Button size="sm" variant="success" className="filter-btn me-1" onClick={() => resolveConflict(i, 'add')}>
                                                                    Cập nhật điểm mới
                                                                </Button>
                                                                <Button size="sm" variant="secondary" className="filter-btn" onClick={() => resolveConflict(i, 'skip')}>
                                                                    Bỏ qua
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : result.raw_data && result.raw_data.length > 0 ? (
                                    <div className="session-table-container">
                                        <div className="table-responsive-mobile">
                                            <table className="table session-table students-table">
                                                <thead>
                                                    <tr>
                                                        <th>Mã SV</th>
                                                        <th>Họ tên</th>
                                                        <th>ĐGCB</th>
                                                        <th>KTTX</th>
                                                        <th>KTGK</th>
                                                        <th>T1</th>
                                                        <th>Trạng thái</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {result.raw_data.map((s, i) => {
                                                        const added = (result.added || []).some(a => a.ma_sv === s.ma_sv);
                                                        const updated = (result.updated || []).some(u => u.ma_sv === s.ma_sv);
                                                        const status = added ? <Badge bg="success">Thêm mới</Badge> : updated ? <Badge bg="primary">Cập nhật</Badge> : <Badge bg="secondary">Bỏ qua</Badge>;
                                                        return (
                                                            <tr key={i}>
                                                                <td>{s.ma_sv}</td>
                                                                <td>{s.name || '-'}</td>
                                                                <td className="text-center">{s.c2 ?? '-'}</td>
                                                                <td className="text-center">{s.b1 ?? '-'}</td>
                                                                <td className="text-center">{s.k1 ?? '-'}</td>
                                                                <td className="text-center">{s.t1 ?? '-'}</td>
                                                                <td>{status}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : null}
                                <div className="mt-3 d-flex gap-2">
                                    <Button variant="primary" className="filter-btn" onClick={() => navigate(`/score-scanning/lists/${id}`)}>
                                        <i className="fas fa-arrow-left me-1"></i>Về danh sách
                                    </Button>
                                    <Button variant="success" className="filter-btn" onClick={retake}>
                                        <i className="fas fa-camera me-1"></i>Chụp tiếp
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <ImageZoomModal
                isOpen={!!zoomedImageUrl}
                imageUrl={zoomedImageUrl}
                onClose={() => setZoomedImageUrl(null)}
            />
        </div>
    );
};

export default ScoreCapturePage;
