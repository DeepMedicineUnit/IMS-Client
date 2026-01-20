import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Spinner, Alert } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/AbsenceConfirmationPreview.css';

const AbsenceConfirmationPreview = () => {
  const { t } = useTranslation();
  usePageTitle(t('absenceConfirmation.title'));
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmationData, setConfirmationData] = useState(null);

  const fetchConfirmationPreview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/absence-requests/public/${id}/preview`);
      
      if (response.data.success) {
        setConfirmationData(response.data.data);
      } else {
        setError(t('absenceConfirmation.cannotLoad'));
      }
    } catch (error) {
      console.error('Error fetching confirmation preview:', error);
      setError(t('absenceConfirmation.loadError'));
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
          <p className="mt-3 fs-5">{t('absenceConfirmation.loading')}</p>
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
            {t('absenceConfirmation.goBack')}
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
      <div className="mobile-action-buttons">
        <Button 
          variant="primary" 
          onClick={handlePrint}
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
        >
          <i className="fas fa-print me-1"></i>
          {t('absenceConfirmation.print')}
        </Button>
      </div>

      {/* Document Preview with Mobile Responsive Styles */}
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
        className="absence-confirmation-preview"
      />
    </div>
  );
};

export default AbsenceConfirmationPreview;
