// Helper functions for hospital locations
// Note: All functions now require hospitalLocations to be passed from the database

export const findHospitalByCoordinates = (latitude, longitude, hospitalLocations) => {
    if (!latitude || !longitude || !hospitalLocations) return null;
    
    const epsilon = 0.0001;
    
    const location = hospitalLocations.find(loc => 
        loc.latitude && loc.longitude &&
        Math.abs(loc.latitude - latitude) < epsilon &&
        Math.abs(loc.longitude - longitude) < epsilon
    );
    
    return location ? location.name : null;
};

export const getHospitalLocationsForSelect = (locations) => {
    if (!locations) return [];
    return locations.map((location, index) => ({
        id: index.toString(),
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude
    }));
};

export const getHospitalLocationsForReports = (locations) => {
    if (!locations) return [];
    return locations.filter(location => 
        location.name !== "-- Chọn vị trí có sẵn --"
    );
};
