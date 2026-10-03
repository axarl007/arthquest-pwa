import { useEffect, useState } from 'react';

/**
 * Tracks whether the app is foregrounded via the Page Visibility API — shared by the camera-scan
 * effect (Pairing.jsx, ticket #17) and the Nearby Connections session effect (useNearbySync.js,
 * ticket #18), both of which need to release a hardware resource (camera / Bluetooth+Wi-Fi radio)
 * while the app is backgrounded rather than running it unattended.
 */
export function useForegroundVisible() {
  const [visible, setVisible] = useState(typeof document === 'undefined' || !document.hidden);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisibilityChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return visible;
}
