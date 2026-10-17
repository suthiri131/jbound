import { Loader } from '@googlemaps/js-api-loader';

let mapsPromise;

export function loadGoogleMaps() {
  if (!mapsPromise) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY');
    const loader = new Loader({
      apiKey,
      version: 'weekly',
      mapIds: import.meta.env.VITE_GOOGLE_MAP_ID ? [import.meta.env.VITE_GOOGLE_MAP_ID] : [],
    });
    mapsPromise = loader.load().catch((error) => {
      mapsPromise = undefined;
      throw error;
    });
  }
  return mapsPromise;
}
