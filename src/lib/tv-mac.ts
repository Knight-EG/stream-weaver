/**
 * Generate a pseudo MAC address for the TV device.
 * On webOS/Tizen the real MAC isn't available via JS, so we generate
 * a persistent device-unique ID that looks like a MAC.
 */
const TV_MAC_KEY = 'iptv_tv_mac';

export function getTvMac(): string {
  let mac = localStorage.getItem(TV_MAC_KEY);
  if (!mac) {
    // Generate a random MAC-like ID
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    // Set locally administered bit
    bytes[0] = (bytes[0] | 0x02) & 0xfe;
    mac = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
    localStorage.setItem(TV_MAC_KEY, mac);
  }
  return mac;
}

/**
 * Generate a short 6-digit activation code
 */
export function generateActivationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}
