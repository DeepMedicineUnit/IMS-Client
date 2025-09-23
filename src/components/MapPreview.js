import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapPreview = forwardRef(({ latitude, longitude, radius, onMapReady }, ref) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const circleRef = useRef(null);
  const markerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  
  // Default coordinates if not provided
  const validLat = latitude || 10.762622;
  const validLng = longitude || 106.660172;
  
  // Initialize map when component mounts or when coordinates change
  useEffect(() => {
    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current && mapRef.current) {
      // Create map instance with enhanced zoom options
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [validLat, validLng],
        zoom: 17, // Start with higher zoom level
        attributionControl: true,
        zoomControl: false, // Disable default zoom control to use custom ones
        minZoom: 3,
        maxZoom: 22, // Increase max zoom level
        zoomSnap: 0.5, // Allow fractional zoom levels
        zoomDelta: 0.5, // Smaller zoom increments for finer control
        wheelPxPerZoomLevel: 100 // More sensitive mouse wheel zoom
      });

      // Add OpenStreetMap tile layer with higher max zoom
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 22, // Match the map's maxZoom
        maxNativeZoom: 19 // This is the maximum zoom level that OSM provides
      }).addTo(mapInstanceRef.current);
      
      // Enable keyboard navigation
      mapInstanceRef.current.keyboard.enable();
      
      // Set map as ready
      setMapReady(true);
      
      // Notify parent component that map is ready if callback provided
      if (onMapReady && typeof onMapReady === 'function') {
        onMapReady(mapInstanceRef.current);
      }
    }

    // Update map view if coordinates change and map exists
    if (mapInstanceRef.current && (latitude && longitude)) {
      // Preserve current zoom level if map is already initialized, otherwise use high zoom
      const currentZoom = mapInstanceRef.current.getZoom();
      const newZoom = currentZoom || 17;
      mapInstanceRef.current.setView([latitude, longitude], newZoom);
      
      // Remove existing marker if it exists
      if (markerRef.current) {
        markerRef.current.remove();
      }
      
      // Add marker at the specified location
      markerRef.current = L.marker([latitude, longitude], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: '<div style="background-color: #dc3545; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(mapInstanceRef.current);
      
      // Remove existing circle if it exists
      if (circleRef.current) {
        circleRef.current.remove();
      }
      
      // Add circle to represent radius if provided
      if (radius > 0) {
        circleRef.current = L.circle([latitude, longitude], {
          color: '#dc3545',
          fillColor: '#dc3545',
          fillOpacity: 0.2,
          weight: 2,
          radius: radius
        }).addTo(mapInstanceRef.current);
        
        // Add popup with radius information
        circleRef.current.bindPopup(`Phạm vi: ${radius} mét`);
      }
    }

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        circleRef.current = null;
        markerRef.current = null;
      }
    };
  }, [latitude, longitude, radius, validLat, validLng]);

  // Force map to recalculate its size when container becomes visible
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        
        // Re-center the map when resizing if coordinates are available
        if (latitude && longitude) {
          mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom());
        }
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Call multiple times with increasing delays to handle different scenarios
    // This helps when the component is rendered in a hidden tab that becomes visible
    const timers = [
      setTimeout(() => handleResize(), 100),
      setTimeout(() => handleResize(), 300),
      setTimeout(() => handleResize(), 800),
      setTimeout(() => handleResize(), 1500)
    ];

    // MutationObserver to detect DOM changes that might affect visibility
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(() => {
        handleResize();
      });
    });
    
    // Observe the parent elements for attribute changes that might affect visibility
    if (mapRef.current) {
      let parent = mapRef.current.parentElement;
      while (parent && parent !== document.body) {
        observer.observe(parent, { 
          attributes: true, 
          attributeFilter: ['style', 'class'],
          subtree: false
        });
        parent = parent.parentElement;
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      timers.forEach(clearTimeout);
      observer.disconnect();
    };
  }, [latitude, longitude]);
  
  // Custom zoom control functions
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };
  
  // Function to zoom to maximum level
  const handleMaxZoom = () => {
    if (mapInstanceRef.current && latitude && longitude) {
      mapInstanceRef.current.setView([latitude, longitude], 22);
    }
  };
  
  // Function to manually refresh the map - expose via ref
  const refreshMap = () => {
    if (mapInstanceRef.current) {
      // Force a resize calculation
      mapInstanceRef.current.invalidateSize(true);
      
      // Re-center if coordinates are available
      if (latitude && longitude) {
        mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom());
      }
      
      return true;
    }
    return false;
  };
  
  // Expose refreshMap method to parent components
  useImperativeHandle(ref, () => ({
    refreshMap,
    invalidateSize: () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize(true);
        return true;
      }
      return false;
    },
    getMapInstance: () => mapInstanceRef.current
  }));

  return (
    <div className="map-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div 
        ref={mapRef} 
        style={{ 
          height: '100%', 
          width: '100%', 
          borderRadius: '4px',
          display: 'block'
        }}
      />
      
      {/* Custom zoom controls */}
      {(latitude && longitude) && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000
        }}>
          <div 
            style={{
              width: '30px',
              height: '30px',
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px 4px 0 0',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 5px rgba(0,0,0,0.2)'
            }} 
            onClick={handleZoomIn}
            title="Phóng to"
            role="button"
            tabIndex={0}
          >
            +
          </div>
          <div 
            style={{
              width: '30px',
              height: '30px',
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderTop: 'none',
              borderRadius: '0',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 5px rgba(0,0,0,0.2)'
            }} 
            onClick={handleZoomOut}
            title="Thu nhỏ"
            role="button"
            tabIndex={0}
          >
            −
          </div>
          <div 
            style={{
              width: '30px',
              height: '30px',
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderTop: 'none',
              borderRadius: '0 0 4px 4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 5px rgba(0,0,0,0.2)'
            }} 
            onClick={handleMaxZoom}
            title="Phóng to tối đa"
            role="button"
            tabIndex={0}
          >
            <i className="fas fa-search-plus"></i>
          </div>
        </div>
      )}
      
      {(!latitude || !longitude) && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          zIndex: 500
        }}>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <i className="fas fa-map-marker-alt mb-3" style={{ fontSize: '32px', color: '#dc3545', display: 'block' }}></i>
            <p style={{ margin: 0, fontWeight: 'bold' }}>Vui lòng nhập tọa độ vĩ độ và kinh độ</p>
            <p style={{ margin: '8px 0 0 0', color: '#6c757d', fontSize: '14px' }}>Hoặc chọn một vị trí có sẵn</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default MapPreview;
