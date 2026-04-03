import { databases, Collections, Query } from "./appwrite";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

// Location type definition
export interface Location {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  locationId: string;
  state: string;
  city: string;
  order: number;
}

/**
 * Get all locations
 */
export const getAllLocations = async (): Promise<Location[]> => {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      Collections.LOCATIONS,
      [
        Query.orderAsc("state"),
        Query.orderAsc("order"),
        Query.limit(500),
      ]
    );
    return response.documents as unknown as Location[];
  } catch (error) {
    console.error("Error fetching locations:", error);
    return [];
  }
};

/**
 * Get locations by state
 */
export const getLocationsByState = async (state: string): Promise<Location[]> => {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      Collections.LOCATIONS,
      [
        Query.equal("state", state),
        Query.orderAsc("order"),
        Query.limit(100),
      ]
    );
    return response.documents as unknown as Location[];
  } catch (error) {
    console.error("Error fetching locations by state:", error);
    return [];
  }
};

/**
 * Get unique states
 */
export const getStates = async (): Promise<string[]> => {
  try {
    const locations = await getAllLocations();
    const states = [...new Set(locations.map(l => l.state))];
    return states.sort();
  } catch (error) {
    console.error("Error fetching states:", error);
    return [];
  }
};

/**
 * Create a new location
 */
export const createLocation = async (
  data: Omit<Location, "$id" | "$createdAt" | "$updatedAt">
): Promise<Location | null> => {
  try {
    const response = await databases.createDocument(
      DATABASE_ID,
      Collections.LOCATIONS,
      "unique()",
      data
    );
    return response as unknown as Location;
  } catch (error) {
    console.error("Error creating location:", error);
    throw error;
  }
};

/**
 * Update a location
 */
export const updateLocation = async (
  documentId: string,
  data: Partial<Omit<Location, "$id" | "$createdAt" | "$updatedAt">>
): Promise<Location | null> => {
  try {
    const response = await databases.updateDocument(
      DATABASE_ID,
      Collections.LOCATIONS,
      documentId,
      data
    );
    return response as unknown as Location;
  } catch (error) {
    console.error("Error updating location:", error);
    throw error;
  }
};

/**
 * Delete a location
 */
export const deleteLocation = async (documentId: string): Promise<boolean> => {
  try {
    await databases.deleteDocument(
      DATABASE_ID,
      Collections.LOCATIONS,
      documentId
    );
    return true;
  } catch (error) {
    console.error("Error deleting location:", error);
    return false;
  }
};

/**
 * Update state name (updates all cities in this state)
 */
export const updateStateName = async (
  oldStateName: string,
  newStateName: string
): Promise<boolean> => {
  try {
    // Get all locations in this state
    const locations = await getLocationsByState(oldStateName);
    
    // Update each location
    await Promise.all(
      locations.map((loc) =>
        databases.updateDocument(DATABASE_ID, Collections.LOCATIONS, loc.$id, {
          state: newStateName,
        })
      )
    );
    
    return true;
  } catch (error) {
    console.error("Error updating state name:", error);
    return false;
  }
};

/**
 * Delete all locations in a state
 */
export const deleteState = async (stateName: string): Promise<boolean> => {
  try {
    // Get all locations in this state
    const locations = await getLocationsByState(stateName);
    
    // Delete each location
    await Promise.all(
      locations.map((loc) =>
        databases.deleteDocument(DATABASE_ID, Collections.LOCATIONS, loc.$id)
      )
    );
    
    return true;
  } catch (error) {
    console.error("Error deleting state:", error);
    return false;
  }
};
