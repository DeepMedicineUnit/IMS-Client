import React from 'react';
import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

// Component to display statistics cards with consistent styling
const StatisticsCard = ({ 
  title, 
  count, 
  icon, 
  bgColor = 'primary', 
  detailPath,
  showButton = true
}) => {
  return (
    <Card className={`bg-${bgColor} text-white h-100 shadow-sm`}>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 className="mb-0">{count}</h2>
            <div className="text-white-50">{title}</div>
          </div>
          <div className="icon-box">
            <i className={`fas ${icon} fa-3x opacity-75`}></i>
          </div>
        </div>
        {showButton && detailPath && (
          <div className="text-end mt-2">
            <Button 
              as={Link} 
              to={detailPath}
              variant="light" 
              size="sm"
              className="text-dark fw-bold"
            >
              Xem chi tiết <i className="fas fa-arrow-right ms-1"></i>
            </Button>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default StatisticsCard;
