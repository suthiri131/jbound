import { Loader } from '@googlemaps/js-api-loader';

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/** Map ID for advanced markers + cloud styling. DEMO_MAP_ID works for development. */
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

/** True once VITE_GOOGLE_MAPS_API_KEY is set in client/.env.local */
export const hasGoogleMaps = Boolean(apiKey);

let loader;

/**
 * Load the Maps JavaScript API once and return the libraries we use.
 * @returns {Promise<{ Map: typeof google.maps.Map, AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement, LatLngBounds: typeof google.maps.LatLngBounds, Polyline: typeof google.maps.Polyline, InfoWindow: typeof google.maps.InfoWindow, SymbolPath: typeof google.maps.SymbolPath }>}
 */
export async function loadGoogleMaps() {
  if (!hasGoogleMaps) throw new Error('VITE_GOOGLE_MAPS_API_KEY is not set');
  loader ||= new Loader({ apiKey, version: 'weekly', region: 'SG', language: 'en' });
  const [{ Map, Polyline, InfoWindow, SymbolPath }, { AdvancedMarkerElement }, { LatLngBounds }] = await Promise.all([
    loader.importLibrary('maps'),
    loader.importLibrary('marker'),
    loader.importLibrary('core'),
  ]);
  return { Map, Polyline, AdvancedMarkerElement, LatLngBounds, InfoWindow, SymbolPath };
}
