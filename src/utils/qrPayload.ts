import jsQR from 'jsqr';

export type QrPayloadType = 'text' | 'wifi' | 'email' | 'phone';

export interface QrPayloadOptions {
  type: QrPayloadType;
  text: string;
  wifiSsid?: string;
  wifiPassword?: string;
  wifiEncryption?: 'WPA' | 'WEP' | 'nopass';
  wifiHidden?: boolean;
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  phone?: string;
}

function escapeWifiField(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

export function formatQrPayload(opts: QrPayloadOptions): string {
  switch (opts.type) {
    case 'wifi': {
      const ssid = escapeWifiField((opts.wifiSsid ?? '').trim());
      if (!ssid) return '';
      const enc = opts.wifiEncryption ?? 'WPA';
      const pass = enc === 'nopass' ? '' : escapeWifiField(opts.wifiPassword ?? '');
      const hidden = opts.wifiHidden ? 'H:true;' : '';
      return `WIFI:T:${enc};S:${ssid};${enc === 'nopass' ? '' : `P:${pass};`}${hidden};`;
    }
    case 'email': {
      const to = (opts.emailTo ?? '').trim();
      if (!to) return '';
      const params = new URLSearchParams();
      if (opts.emailSubject?.trim()) params.set('subject', opts.emailSubject.trim());
      if (opts.emailBody?.trim()) params.set('body', opts.emailBody.trim());
      const query = params.toString();
      return `mailto:${to}${query ? `?${query}` : ''}`;
    }
    case 'phone': {
      const num = (opts.phone ?? '').trim();
      return num ? `tel:${num}` : '';
    }
    case 'text':
    default:
      return opts.text.trim();
  }
}

export function decodeQrFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): string | null {
  const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  return result?.data ?? null;
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
