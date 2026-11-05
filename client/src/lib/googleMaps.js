import { Loader } from "@googlemaps/js-api-loader";

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || "DEMO_MAP_ID";

export const hasGoogleMaps = Boolean(apiKey);

let loader;

/**
 * Load the Maps JavaScript API once and return the libraries we use.
 * @returns {Promise<{ Map: typeof google.maps.Map, AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement, LatLngBounds: typeof google.maps.LatLngBounds, Polyline: typeof google.maps.Polyline, InfoWindow: typeof google.maps.InfoWindow, SymbolPath: typeof google.maps.SymbolPath }>}
 */
export async function loadGoogleMaps() {
  if (!hasGoogleMaps) throw new Error("VITE_GOOGLE_MAPS_API_KEY is not set");
  // 'alpha' is a superset of 'weekly' — needed so the same loader can also serve 'maps3d' below.
  // 'weekly' (the stable channel) includes 'maps3d' since Oct 2025; 'alpha' shows Google's dev-only banner.
  loader ||= new Loader({
    apiKey,
    version: "weekly",
    region: "SG",
    language: "en",
  });
  const [
    { Map, Polyline, InfoWindow },
    { AdvancedMarkerElement },
    { LatLngBounds, SymbolPath },
  ] = await Promise.all([
    loader.importLibrary("maps"),
    loader.importLibrary("marker"),
    loader.importLibrary("core"),
  ]);
  return {
    Map,
    Polyline,
    AdvancedMarkerElement,
    LatLngBounds,
    InfoWindow,
    SymbolPath,
  };
}

/**
 * Load the Maps JS API's "maps3d" library (Map3DElement, Marker3DElement, Polyline3DElement).
 * Reuses the same Loader singleton as loadGoogleMaps — a second Loader with different options throws.
 * @returns {Promise<{ Map3DElement: typeof google.maps.maps3d.Map3DElement, Marker3DElement: typeof google.maps.maps3d.Marker3DElement, Polyline3DElement: typeof google.maps.maps3d.Polyline3DElement, AltitudeMode: typeof google.maps.maps3d.AltitudeMode }>}
 */
export async function loadGoogleMaps3D() {
  if (!hasGoogleMaps) throw new Error("VITE_GOOGLE_MAPS_API_KEY is not set");
  loader ||= new Loader({
    apiKey,
    version: "alpha",
    region: "SG",
    language: "en",
  });
  const [
    {
      Marker3DInteractiveElement,
      Polyline3DElement,
      AltitudeMode,
      Map3DElement,
    },
    { PinElement },
  ] = await Promise.all([
    loader.importLibrary("maps3d"),
    loader.importLibrary("marker"),
  ]);
  return {
    Map3DElement,
    Marker3DInteractiveElement,
    Polyline3DElement,
    AltitudeMode,
    PinElement,
  };
}
