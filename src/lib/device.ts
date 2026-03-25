const DEVICE_ID_KEY = 'iptv_device_id';
const DEVICE_NAME_KEY = 'iptv_device_name';

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceName(): string {
  let name = localStorage.getItem(DEVICE_NAME_KEY);
  if (!name) {
    const ua = navigator.userAgent;
    if (/Tizen/i.test(ua)) name = 'Samsung TV';
    else if (/webOS/i.test(ua)) name = 'LG TV';
    else if (/Android TV/i.test(ua)) name = 'Android TV';
    else if (/Mobile/i.test(ua)) name = 'Mobile Device';
    else name = 'Web Browser';
    localStorage.setItem(DEVICE_NAME_KEY, name);
  }
  return name;
}

export function getPlatform(): string {
  const ua = navigator.userAgent;
  if (/Tizen/i.test(ua)) return 'tizen';
  if (/webOS/i.test(ua)) return 'webos';
  if (/Android TV/i.test(ua)) return 'android_tv';
  if (/Android/i.test(ua)) return 'android';
  return 'web';
}
