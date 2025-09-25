import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Spinner, Alert } from 'react-bootstrap';
import axios from 'axios';

const AbsenceConfirmationPreview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmationData, setConfirmationData] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const fetchConfirmationPreview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`https://clinical.pctu.edu.vn/api/absence-requests/public/${id}/preview`);
      
      if (response.data.success) {
        setConfirmationData(response.data.data);
      } else {
        setError('Không thể tải đơn xác nhận');
      }
    } catch (error) {
      console.error('Error fetching confirmation preview:', error);
      setError('Lỗi khi tải đơn xác nhận');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchConfirmationPreview();
  }, [fetchConfirmationPreview]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(confirmationData.html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      console.log('Starting PDF download...');
      
      // Use fetch instead of axios for better blob handling
      const response = await fetch(`https://clinical.pctu.edu.vn/api/absence-requests/${id}/pdf`, {
        method: 'GET'
      });
      
      console.log('PDF response received:', response.status, response.statusText);
      console.log('Content-Type:', response.headers.get('content-type'));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        setError(`Lỗi server: ${response.status}`);
        return;
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/pdf')) {
        const blob = await response.blob();
        console.log('Blob created:', blob.size, 'bytes');
        
        // Validate PDF blob
        if (blob.size === 0) {
          setError('File PDF trống');
          return;
        }
        
        // Check PDF header in blob
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const header = String.fromCharCode(...uint8Array.slice(0, 4));
        console.log('PDF header in blob:', header);
        
        if (header !== '%PDF') {
          console.error('Invalid PDF header in blob:', header);
          setError('File PDF không hợp lệ');
          return;
        }
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `don_xac_nhan_vang_hoc_${confirmationData.request.studentId}_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log('PDF download completed successfully');
      } else {
        setError('Response không phải là file PDF');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      setError('Lỗi khi tải xuống PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 9999,
        backgroundColor: '#f5f5f5',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" size="lg" />
          <p className="mt-3 fs-5">Đang tải đơn xác nhận...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 9999,
        backgroundColor: '#f5f5f5',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
      }}>
        <div className="text-center">
          <Alert variant="danger" className="mb-4">
            <i className="fas fa-exclamation-triangle me-2"></i>
            {error}
          </Alert>
          <Button variant="outline-primary" onClick={() => navigate(-1)}>
            <i className="fas fa-arrow-left me-1"></i>
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      zIndex: 9999,
      backgroundColor: '#f5f5f5',
      padding: '10px'
    }}>
      {/* Floating Action Buttons */}
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        zIndex: 10000,
        display: 'flex',
        gap: '10px'
      }}>
        <Button 
          variant="primary" 
          onClick={handlePrint}
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
        >
          <i className="fas fa-print me-1"></i>
          In
        </Button>
        <Button 
          variant="success" 
          onClick={handleDownload}
          disabled={downloading}
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
        >
          {downloading ? (
            <>
              <Spinner animation="border" size="sm" className="me-1" />
              Đang tải xuống PDF
            </>
          ) : (
            <>
              <i className="fas fa-file-pdf me-1"></i>
              Tải xuống PDF
            </>
          )}
        </Button>
      </div>

      {/* Document Preview */}
      <div 
        dangerouslySetInnerHTML={{ __html: confirmationData.html }}
        style={{ 
          width: '100%',
          height: '100%',
          overflow: 'auto',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      />
    </div>
  );
};

export default AbsenceConfirmationPreview;
