import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Camera,
  CameraOff,
  Check,
  Copy,
  Download,
  ExternalLink,
  ImagePlus,
  QrCode,
  ScanLine,
  Trash2,
} from 'lucide-react';
import {
  decodeQrFromImageData,
  formatQrPayload,
  isHttpUrl,
  type QrPayloadType,
} from '../../utils/qrPayload';

type TabMode = 'generate' | 'scan';

export function QrCodeTool() {
  const [activeTab, setActiveTab] = useState<TabMode>('generate');

  // Generator state
  const [payloadType, setPayloadType] = useState<QrPayloadType>('text');
  const [textValue, setTextValue] = useState('https://nexctool.com');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiEncryption, setWifiEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [phone, setPhone] = useState('');

  const [fgColor, setFgColor] = useState('#0F172A');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [ecLevel, setEcLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [qrSize, setQrSize] = useState<number>(512);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Scanner state
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [copiedScan, setCopiedScan] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const payload = useMemo(
    () =>
      formatQrPayload({
        type: payloadType,
        text: textValue,
        wifiSsid,
        wifiPassword,
        wifiEncryption,
        emailTo,
        emailSubject,
        phone,
      }),
    [payloadType, textValue, wifiSsid, wifiPassword, wifiEncryption, emailTo, emailSubject, phone]
  );

  const effectiveEcLevel = logoDataUrl ? 'H' : ecLevel;

  // Render live QR preview on canvas
  useEffect(() => {
    if (activeTab !== 'generate') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!payload) {
      canvas.width = qrSize;
      canvas.height = qrSize;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, qrSize, qrSize);
      setGenError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await QRCode.toCanvas(canvas, payload, {
          width: qrSize,
          margin: 2,
          errorCorrectionLevel: effectiveEcLevel,
          color: {
            dark: fgColor,
            light: bgColor,
          },
        });

        if (cancelled) return;

        if (logoDataUrl) {
          const img = new Image();
          img.onload = () => {
            if (cancelled) return;
            const logoBox = Math.round(qrSize * 0.22);
            const x = Math.round((qrSize - logoBox) / 2);
            const y = Math.round((qrSize - logoBox) / 2);
            const pad = Math.round(logoBox * 0.14);
            ctx.fillStyle = bgColor;
            ctx.beginPath();
            ctx.roundRect(x - pad, y - pad, logoBox + pad * 2, logoBox + pad * 2, 12);
            ctx.fill();
            ctx.drawImage(img, x, y, logoBox, logoBox);
          };
          img.src = logoDataUrl;
        }
        setGenError(null);
      } catch (err) {
        if (!cancelled) {
          setGenError(err instanceof Error ? err.message : 'Unable to generate QR code.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, payload, qrSize, fgColor, bgColor, effectiveEcLevel, logoDataUrl]);

  const stopCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (scanPreviewUrl) URL.revokeObjectURL(scanPreviewUrl);
    };
  }, [scanPreviewUrl]);

  const handleTabSwitch = (next: TabMode) => {
    if (next !== 'scan') stopCamera();
    setActiveTab(next);
  };

  const handleLogoUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas || !payload) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nexctool-qrcode.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/png');
  };

  const handleDownloadSvg = async () => {
    if (!payload) return;
    try {
      const svgString = await QRCode.toString(payload, {
        type: 'svg',
        width: qrSize,
        margin: 2,
        errorCorrectionLevel: effectiveEcLevel,
        color: {
          dark: fgColor,
          light: bgColor,
        },
      });
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nexctool-qrcode.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Unable to export SVG.');
    }
  };

  const handleScanImageFile = (file: File | undefined) => {
    if (!file) return;
    stopCamera();
    setScanError(null);
    setScanResult(null);

    const url = URL.createObjectURL(file);
    setScanPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });

    const img = new Image();
    img.onload = () => {
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const w = Math.max(1, Math.round((img.naturalWidth || 300) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || 300) * scale));
      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext('2d');
      if (!ctx) {
        setScanError('Canvas context unavailable.');
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const decoded = decodeQrFromImageData(imgData.data, w, h);
      if (decoded) {
        setScanResult(decoded);
      } else {
        setScanError('No QR code detected in this image. Try a clearer or tighter crop.');
      }
    };
    img.onerror = () => {
      setScanError('Could not read the selected image file.');
    };
    img.src = url;
  };

  const handleStartCamera = async () => {
    setScanError(null);
    setScanResult(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError('Camera scanning is not supported in this browser. Upload an image instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const scanCanvas = document.createElement('canvas');
      const scanLoop = () => {
        if (!streamRef.current || !videoRef.current) return;
        const v = videoRef.current;
        if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
          scanCanvas.width = v.videoWidth;
          scanCanvas.height = v.videoHeight;
          const ctx = scanCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(v, 0, 0, v.videoWidth, v.videoHeight);
            const imgData = ctx.getImageData(0, 0, v.videoWidth, v.videoHeight);
            const decoded = decodeQrFromImageData(imgData.data, v.videoWidth, v.videoHeight);
            if (decoded) {
              setScanResult(decoded);
              stopCamera();
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(scanLoop);
      };
      rafRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      stopCamera();
      setScanError(
        err instanceof Error
          ? `Camera access denied or unavailable: ${err.message}`
          : 'Unable to open camera.'
      );
    }
  };

  const handleCopyScan = async () => {
    if (!scanResult) return;
    try {
      await navigator.clipboard.writeText(scanResult);
      setCopiedScan(true);
      setTimeout(() => setCopiedScan(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="inline-flex rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 p-1 gap-1">
        <button
          type="button"
          onClick={() => handleTabSwitch('generate')}
          className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-full transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'generate'
              ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <QrCode className="w-4 h-4" aria-hidden="true" />
          <span>Generate QR Code</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabSwitch('scan')}
          className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-full transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'scan'
              ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ScanLine className="w-4 h-4" aria-hidden="true" />
          <span>Scan QR Code</span>
        </button>
      </div>

      {activeTab === 'generate' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Controls */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                QR Content Type
              </span>
              <div className="inline-flex flex-wrap rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-1 gap-1">
                {(
                  [
                    { id: 'text', label: 'URL / Text' },
                    { id: 'wifi', label: 'Wi-Fi' },
                    { id: 'email', label: 'Email' },
                    { id: 'phone', label: 'Phone' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPayloadType(t.id)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      payloadType === t.id
                        ? 'bg-white dark:bg-slate-800 text-[#4F46E5] dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {payloadType === 'text' && (
              <div>
                <label htmlFor="qr-text" className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Website URL or Plain Text
                </label>
                <textarea
                  id="qr-text"
                  rows={3}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder="https://nexctool.com or any message..."
                  className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
            )}

            {payloadType === 'wifi' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="qr-ssid" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                    Network Name (SSID)
                  </label>
                  <input
                    id="qr-ssid"
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="MyWiFiNetwork"
                    className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="qr-wifi-enc" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                    Security Type
                  </label>
                  <select
                    id="qr-wifi-enc"
                    value={wifiEncryption}
                    onChange={(e) => setWifiEncryption(e.target.value as 'WPA' | 'WEP' | 'nopass')}
                    className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">Open (No Password)</option>
                  </select>
                </div>
                {wifiEncryption !== 'nopass' && (
                  <div className="sm:col-span-2">
                    <label htmlFor="qr-wifi-pass" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                      Wi-Fi Password
                    </label>
                    <input
                      id="qr-wifi-pass"
                      type="text"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      placeholder="Enter Wi-Fi password"
                      className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            )}

            {payloadType === 'email' && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="qr-email-to" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                    Recipient Email
                  </label>
                  <input
                    id="qr-email-to"
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="hello@example.com"
                    className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="qr-email-sub" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                    Subject (Optional)
                  </label>
                  <input
                    id="qr-email-sub"
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Quick inquiry"
                    className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {payloadType === 'phone' && (
              <div>
                <label htmlFor="qr-phone" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                  Phone Number
                </label>
                <input
                  id="qr-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+94 77 123 4567"
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            )}

            {/* Styling controls */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div>
                <label htmlFor="qr-fg" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Foreground
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="qr-fg"
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-9 h-9 rounded border border-slate-300 dark:border-slate-700 cursor-pointer bg-white"
                  />
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{fgColor}</span>
                </div>
              </div>

              <div>
                <label htmlFor="qr-bg" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Background
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="qr-bg"
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-9 h-9 rounded border border-slate-300 dark:border-slate-700 cursor-pointer bg-white"
                  />
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{bgColor}</span>
                </div>
              </div>

              <div>
                <label htmlFor="qr-size" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Size (px)
                </label>
                <select
                  id="qr-size"
                  value={qrSize}
                  onChange={(e) => setQrSize(Number(e.target.value))}
                  className="w-full h-9 px-2.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value={256}>256 × 256</option>
                  <option value={512}>512 × 512</option>
                  <option value={1024}>1024 × 1024</option>
                </select>
              </div>

              <div>
                <label htmlFor="qr-ec" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Error Level
                </label>
                <select
                  id="qr-ec"
                  value={effectiveEcLevel}
                  disabled={Boolean(logoDataUrl)}
                  onChange={(e) => setEcLevel(e.target.value as 'L' | 'M' | 'Q' | 'H')}
                  className="w-full h-9 px-2.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white disabled:opacity-60"
                >
                  <option value="L">L (7%)</option>
                  <option value="M">M (15%)</option>
                  <option value="Q">Q (25%)</option>
                  <option value="H">H (30%)</option>
                </select>
              </div>
            </div>

            {/* Center Logo */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                <ImagePlus className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
                <span>{logoDataUrl ? 'Change Center Logo' : 'Add Center Logo (Optional)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                />
              </label>
              {logoDataUrl && (
                <button
                  type="button"
                  onClick={() => setLogoDataUrl(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Remove Logo</span>
                </button>
              )}
            </div>

            {genError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{genError}</p>
            )}
          </div>

          {/* Right Preview & Download */}
          <div className="lg:col-span-5 flex flex-col items-center p-5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <canvas
                ref={canvasRef}
                aria-label="Generated QR code preview"
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
              />
            </div>
            {!payload && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enter content on the left to generate your QR code.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
              <button
                type="button"
                disabled={!payload}
                onClick={handleDownloadPng}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#16A34A] hover:bg-[#15803D] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-sm font-semibold rounded-full shadow-xs cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>Download PNG</span>
              </button>
              <button
                type="button"
                disabled={!payload || Boolean(logoDataUrl)}
                title={logoDataUrl ? 'SVG export does not embed raster center logos; use PNG instead.' : 'Download scalable vector SVG'}
                onClick={handleDownloadSvg}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-[#4F46E5] disabled:opacity-50 text-slate-800 dark:text-slate-100 text-sm font-semibold rounded-full cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>Download SVG</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 hover:border-[#4F46E5] transition-colors cursor-pointer text-center">
              <ImagePlus className="w-8 h-8 text-[#4F46E5] dark:text-indigo-400 mb-2" aria-hidden="true" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Upload QR Code Image
              </span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                PNG, JPG, WebP, or screenshot
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleScanImageFile(e.target.files?.[0])}
              />
            </label>

            <div className="flex flex-col items-center justify-center p-6 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 text-center space-y-3">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full max-h-48 rounded-xl bg-black object-cover"
                  />
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-full cursor-pointer"
                  >
                    <CameraOff className="w-4 h-4" aria-hidden="true" />
                    <span>Stop Camera</span>
                  </button>
                </>
              ) : (
                <>
                  <Camera className="w-8 h-8 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Scan with Device Camera
                  </div>
                  <button
                    type="button"
                    onClick={handleStartCamera}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-xs font-semibold rounded-full shadow-xs cursor-pointer"
                  >
                    <Camera className="w-4 h-4" aria-hidden="true" />
                    <span>Start Camera Scan</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {scanPreviewUrl && !cameraActive && (
            <div className="max-w-xs border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-white dark:bg-slate-900">
              <img src={scanPreviewUrl} alt="Uploaded QR code" className="max-h-44 mx-auto rounded object-contain" />
            </div>
          )}

          {scanError && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200"
            >
              {scanError}
            </div>
          )}

          {scanResult && (
            <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Decoded QR Content
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyScan}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    {copiedScan ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScan ? 'Copied' : 'Copy'}</span>
                  </button>
                  {isHttpUrl(scanResult) && (
                    <a
                      href={scanResult.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-full text-xs font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Open Link</span>
                    </a>
                  )}
                </div>
              </div>
              <pre className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 overflow-x-auto whitespace-pre-wrap break-all">
                {scanResult}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
