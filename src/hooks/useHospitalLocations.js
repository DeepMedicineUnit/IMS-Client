import { useState, useEffect } from 'react';
import api from '../utils/api';

export const useHospitalLocations = () => {
    const [hospitalLocations, setHospitalLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchHospitalLocations = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await api.get('/sessions/hospital-locations');
            
            if (response.data.success) {
                // Add placeholder option at the beginning
                const locationsWithPlaceholder = [
                    { id: 0, name: "-- Chọn vị trí có sẵn --", latitude: null, longitude: null },
                    ...response.data.data
                ];
                setHospitalLocations(locationsWithPlaceholder);
            } else {
                setError('Không thể tải danh sách địa điểm bệnh viện');
            }
        } catch (error) {
            console.error('Error fetching hospital locations:', error);
            setError('Đã xảy ra lỗi khi tải danh sách địa điểm bệnh viện');
        } finally {
            setLoading(false);
        }
    };

    const addHospitalLocation = (newLocation) => {
        setHospitalLocations(prev => [...prev, newLocation]);
    };

    const removeHospitalLocation = (locationName) => {
        setHospitalLocations(prev => prev.filter(loc => loc.name !== locationName));
    };

    useEffect(() => {
        fetchHospitalLocations();
    }, []);

    return {
        hospitalLocations,
        loading,
        error,
        refetch: fetchHospitalLocations,
        addHospitalLocation,
        removeHospitalLocation
    };
};

// Helper functions for backward compatibility
export const findHospitalByCoordinates = (latitude, longitude, hospitalLocations) => {
    if (!latitude || !longitude || !hospitalLocations) return null;
    
    // Use a small epsilon for floating point comparison
    const epsilon = 0.0001;
    
    const location = hospitalLocations.find(loc => 
        loc.latitude && loc.longitude &&
        Math.abs(loc.latitude - latitude) < epsilon &&
        Math.abs(loc.longitude - longitude) < epsilon
    );
    
    return location ? location.name : null;
};

export const getHospitalLocationsForSelect = (locations) => {
    return locations.map((location, index) => ({
        id: index.toString(),
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude
    }));
};

export const getHospitalLocationsForReports = (locations) => {
    return locations.filter(location => 
        location.name !== "-- Chọn vị trí có sẵn --"
    );
};
