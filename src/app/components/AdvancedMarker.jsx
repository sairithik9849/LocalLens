'use client';

import { useEffect, useRef } from 'react';
import { useGoogleMap } from '@react-google-maps/api';

/**
 * AdvancedMarker component that uses google.maps.marker.AdvancedMarkerElement
 * This replaces the deprecated google.maps.Marker
 */
const AdvancedMarker = ({ position, title, iconUrl }) => {
  const map = useGoogleMap();
  const markerRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!map || !position) return;

    let isMounted = true;

    // Import AdvancedMarkerElement when available
    const initMarker = async () => {
      try {
        // Check if AdvancedMarkerElement is available
        if (!window.google?.maps?.marker?.AdvancedMarkerElement) {
          // Try to import it
          if (window.google?.maps?.importLibrary) {
            await window.google.maps.importLibrary('marker');
          } else {
            console.warn('AdvancedMarkerElement not available.');
            return;
          }
        }

        if (!isMounted) return;

        const { AdvancedMarkerElement } = window.google.maps.marker;

        // Clean up existing marker
        if (markerRef.current) {
          markerRef.current.map = null;
          markerRef.current = null;
        }

        // Create content element with icon
        const markerContent = document.createElement('div');
        markerContent.style.width = '32px';
        markerContent.style.height = '32px';
        markerContent.style.backgroundSize = 'contain';
        markerContent.style.backgroundRepeat = 'no-repeat';
        markerContent.style.backgroundPosition = 'center';
        markerContent.style.cursor = 'pointer';
        
        if (iconUrl) {
          markerContent.style.backgroundImage = `url(${iconUrl})`;
        } else {
          // Default red dot
          markerContent.style.backgroundImage = 'url(https://maps.google.com/mapfiles/ms/icons/red-dot.png)';
        }
        
        if (title) {
          markerContent.title = title;
        }

        // Create the advanced marker
        const marker = new AdvancedMarkerElement({
          map: map,
          position: position,
          title: title,
          content: markerContent,
        });

        if (isMounted) {
          markerRef.current = marker;
          contentRef.current = markerContent;
        } else {
          // Component unmounted before marker was created
          marker.map = null;
        }
      } catch (error) {
        console.error('Error creating AdvancedMarker:', error);
      }
    };

    initMarker();

    // Cleanup
    return () => {
      isMounted = false;
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
    };
  }, [map, position, title, iconUrl]);

  return null; // This component doesn't render anything
};

export default AdvancedMarker;

