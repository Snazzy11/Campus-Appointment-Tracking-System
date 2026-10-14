export function onLocationHidden(stop: () => void) {
  const hidden = () => { if(document.visibilityState !== 'visible')stop(); };
  document.addEventListener('visibilitychange',hidden);
  window.addEventListener('pagehide',stop);
  return () => {document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',stop);};
}
