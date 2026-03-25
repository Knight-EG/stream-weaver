export function isTVDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  
  // Samsung Tizen
  if (/Tizen/i.test(ua)) return true;
  // LG webOS
  if (/webOS/i.test(ua)) return true;
  // Android TV
  if (/Android TV/i.test(ua)) return true;
  // Fire TV
  if (/AFTM|AFTT|AFTS|AFTB|AFTSS/i.test(ua)) return true;
  // Generic smart TV
  if (/SmartTV|Smart TV|SMART-TV|GoogleTV|HbbTV/i.test(ua)) return true;
  // PlayStation / Xbox
  if (/PlayStation|Xbox/i.test(ua)) return true;
  // Roku
  if (/Roku/i.test(ua)) return true;

  // Check for TV-mode URL parameter (for testing)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tv') === '1' || params.get('mode') === 'tv') return true;
  }

  return false;
}
