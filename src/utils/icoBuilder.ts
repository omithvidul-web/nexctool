export interface IcoFrameInput {
  width: number;
  height: number;
  pngBytes: Uint8Array;
}

/**
 * Builds a valid Windows/Browser .ico file wrapping PNG-compressed icon frames
 * (supports 16x16, 32x32, 48x48, up to 256x256).
 */
export function buildIcoFromPngFrames(frames: IcoFrameInput[]): Uint8Array {
  if (frames.length === 0) {
    throw new Error('At least one PNG frame is required to build an .ico file.');
  }

  const headerSize = 6;
  const dirEntrySize = 16;
  const dirTotalSize = headerSize + frames.length * dirEntrySize;
  const payloadTotalSize = frames.reduce((acc, f) => acc + f.pngBytes.byteLength, 0);

  const out = new Uint8Array(dirTotalSize + payloadTotalSize);
  const view = new DataView(out.buffer);

  // ICONDIR header
  view.setUint16(0, 0, true); // Reserved: must be 0
  view.setUint16(2, 1, true); // Type: 1 = icon
  view.setUint16(4, frames.length, true); // Image count

  let offset = dirTotalSize;
  frames.forEach((frame, index) => {
    const entryOffset = headerSize + index * dirEntrySize;
    const wByte = frame.width >= 256 ? 0 : Math.max(1, Math.min(255, Math.round(frame.width)));
    const hByte = frame.height >= 256 ? 0 : Math.max(1, Math.min(255, Math.round(frame.height)));

    out[entryOffset + 0] = wByte; // Width (0 means 256)
    out[entryOffset + 1] = hByte; // Height (0 means 256)
    out[entryOffset + 2] = 0; // Color palette count (0 for PNG)
    out[entryOffset + 3] = 0; // Reserved
    view.setUint16(entryOffset + 4, 1, true); // Color planes
    view.setUint16(entryOffset + 6, 32, true); // Bits per pixel
    view.setUint32(entryOffset + 8, frame.pngBytes.byteLength, true); // Size of PNG data
    view.setUint32(entryOffset + 12, offset, true); // Offset from start of file

    out.set(frame.pngBytes, offset);
    offset += frame.pngBytes.byteLength;
  });

  return out;
}

export function buildWebManifestJson(appName: string, themeColor: string, bgColor: string): string {
  const safeName = appName.trim() || 'My Web App';
  return JSON.stringify(
    {
      name: safeName,
      short_name: safeName.slice(0, 16),
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: themeColor,
      background_color: bgColor,
      display: 'standalone',
    },
    null,
    2
  );
}

export const FAVICON_HTML_SNIPPET = `<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />`;
