import { useEffect } from 'react';
import './mobile.css';

export function WebViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      // Follow Safari's keyboard/browser bars without fighting pinch-to-zoom.
      if (Math.abs(viewport.scale - 1) < 0.01) {
        document.documentElement.style.setProperty('--app-viewport-height', `${viewport.height}px`);
      }
    };
    update();
    viewport.addEventListener('resize', update);
    return () => {
      viewport.removeEventListener('resize', update);
      document.documentElement.style.removeProperty('--app-viewport-height');
    };
  }, []);
  return null;
}
