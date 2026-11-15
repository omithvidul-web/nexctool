import type { ToolItem } from '../data/tools';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${exponent === 0 ? value.toFixed(0) : value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[exponent]}`;
}

export function calculateSavingsPercent(originalBytes: number, outputBytes: number): number {
  if (originalBytes <= 0) return 0;
  return Math.round(((originalBytes - outputBytes) / originalBytes) * 100);
}

export function replaceExtension(filename: string, newExt: string): string {
  const cleanExt = newExt.startsWith('.') ? newExt.slice(1) : newExt;
  const dotIdx = filename.lastIndexOf('.');
  const base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
  return `${base}.${cleanExt}`;
}

export interface ToolSeoContent {
  titleTag: string;
  metaDescription: string;
  steps: { title: string; description: string }[];
  features: { title: string; description: string }[];
  faqs: { question: string; answer: string }[];
}

const INTERACTIVE_STEPS: Record<string, { title: string; description: string }[]> = {
  'qr-code': [
    {
      title: 'Choose Generate or Scan mode',
      description: 'Pick URL/Text, Wi-Fi, Email, or Phone to create a QR code, or switch to Scan QR Code to decode from an image or camera.',
    },
    {
      title: 'Customize colors, size & logo',
      description: 'Adjust foreground/background colors, error correction level, and optionally place a center logo inside your QR code.',
    },
    {
      title: 'Download PNG/SVG or copy result',
      description: 'Save a crisp high-resolution PNG or scalable SVG QR code, or copy/open decoded links instantly in your browser.',
    },
  ],
  'favicon-pack': [
    {
      title: 'Upload your brand logo',
      description: 'Select a square PNG, SVG, JPG, or WebP logo (or test immediately with the built-in sample icon).',
    },
    {
      title: 'Adjust background, padding & radius',
      description: 'Choose transparent or solid background fill, inner icon padding, and rounded/squircle corners while previewing the browser tab.',
    },
    {
      title: 'Download full ZIP or favicon.ico',
      description: 'Export multi-resolution favicon.ico (16/32/48px), Apple Touch 180px, Android 192/512px PNGs, site.webmanifest, and HTML tags.',
    },
  ],
  'image-blur': [
    {
      title: 'Upload photo or screenshot',
      description: 'Load any JPG, PNG, WebP, or SVG image directly inside your browser without uploading to any server.',
    },
    {
      title: 'Drag to blur, pixelate, or blackout',
      description: 'Pick Blur, Pixelate, Black Box, or White Box mode and drag over sensitive faces, ID numbers, or text.',
    },
    {
      title: 'Export redacted image locally',
      description: 'Undo or adjust regions anytime, then download the clean redacted PNG or JPG file directly to your device.',
    },
  ],
  'image-collage': [
    {
      title: 'Select 2 to 9 images',
      description: 'Upload multiple JPG, PNG, WebP, or SVG photos and reorder them in any sequence.',
    },
    {
      title: 'Pick Side-by-Side, Grid, or Before/After',
      description: 'Adjust gap spacing, outer padding, corner radius, fit mode, and frame background color with live preview.',
    },
    {
      title: 'Download high-resolution collage',
      description: 'Export your finished collage at 1200px, 1600px, or 2400px width as PNG, JPG, or WebP.',
    },
  ],
  'invoice-pdf': [
    {
      title: 'Enter sender, client & invoice details',
      description: 'Choose Invoice, Receipt, or Quote, pick your currency and accent color, and optionally attach your business logo.',
    },
    {
      title: 'Add line items, discount & tax',
      description: 'Fill in descriptions, quantities, and rates—subtotals and grand totals update live in the paper preview.',
    },
    {
      title: 'Download formatted A4 PDF',
      description: 'Click Download PDF to generate a clean printable PDF document completely offline inside your browser.',
    },
  ],
  'image-ocr': [
    {
      title: 'Upload image or paste screenshot',
      description: 'Select an image file or press Ctrl+V to paste a screenshot directly into the browser OCR workspace.',
    },
    {
      title: 'Choose language & extract text',
      description: 'Pick English, Sinhala, Tamil, or another supported language and run WebAssembly OCR locally.',
    },
    {
      title: 'Edit, copy, or download .txt',
      description: 'Review the recognized text side-by-side with your image and copy to clipboard or save as a .txt file.',
    },
  ],
  'screen-voice-recorder': [
    {
      title: 'Pick Screen or Voice recording mode',
      description: 'Choose Screen Recorder (with optional system & microphone audio) or Voice Recorder with live waveform.',
    },
    {
      title: 'Record, pause, and stop locally',
      description: 'Capture your screen or microphone directly inside your browser tab without installing extensions.',
    },
    {
      title: 'Preview and download video or audio',
      description: 'Play back your recording immediately and download as MP4/WebM video or MP3/WAV audio.',
    },
  ],
  'subtitle-tool': [
    {
      title: 'Upload or paste .SRT / .VTT subtitles',
      description: 'Load an existing .srt or .vtt file or paste raw subtitle cues directly into the editor.',
    },
    {
      title: 'Shift timing & choose target format',
      description: 'Adjust timestamps forward or backward in seconds and pick .srt, .vtt, or .txt output.',
    },
    {
      title: 'Copy or download converted subtitles',
      description: 'Inspect the live output with exact cue counts and download or copy in one click.',
    },
  ],
  'social-video-pad': [
    {
      title: 'Upload your video clip',
      description: 'Load an MP4, MOV, or WebM video clip directly in your browser with full audio support.',
    },
    {
      title: 'Pick 9:16, 1:1, 4:5, or 16:9 & background',
      description: 'Choose TikTok/Reels vertical, Square, or Feed ratio and select Blurred Video BG, Solid Color, or Center Crop.',
    },
    {
      title: 'Render and download privately',
      description: 'Export the resized video directly on your device with audio intact and zero server uploads.',
    },
  ],
  'ringtone-maker': [
    {
      title: 'Upload your song or audio clip',
      description: 'Load MP3, WAV, M4A, OGG, or FLAC audio and inspect its visual waveform immediately.',
    },
    {
      title: 'Set Start, End, Fade-In & Fade-Out',
      description: 'Trim your exact favorite clip, apply smooth fade-in and fade-out ramps, and test with Preview Ringtone.',
    },
    {
      title: 'Download as MP3 or WAV',
      description: 'Export your finished custom ringtone in seconds directly inside your browser.',
    },
  ],
};

export function buildToolSeoContent(tool: ToolItem): ToolSeoContent {
  const titleTag = `${tool.name} Free Online - NexcTool`;
  const metaDescription = `${tool.name} online for free with NexcTool. ${tool.description} 100% private—your file never leaves your device.`;

  const isMulti = tool.multiple;
  const isTextOrFile = tool.mode === 'text-or-file';
  const customSteps = tool.interactiveKind ? INTERACTIVE_STEPS[tool.interactiveKind] : undefined;

  const steps =
    customSteps ??
    (isTextOrFile
      ? [
          {
            title: 'Add your file or paste text',
            description: `Drop your file into the NexcTool box or paste raw content directly into the editor.`,
          },
          {
            title: 'Choose options & run locally',
            description: `Adjust any formatting or conversion preferences, then click "${tool.actionLabel}".`,
          },
          {
            title: 'Copy or download the result',
            description: `Inspect the instant output in your browser and copy to clipboard or save the file.`,
          },
        ]
      : [
          {
            title: isMulti ? 'Select your files' : 'Select your file',
            description: `Drag and drop ${isMulti ? 'two or more files' : 'your file'} onto the upload zone or pick from your device.`,
          },
          {
            title: `Configure ${tool.name}`,
            description: `Review your file details, adjust any available output settings, and start processing locally.`,
          },
          {
            title: 'Download instantly',
            description: `Once finished, click the green Download button to save your processed file straight to your device.`,
          },
        ]);

  const features = [
    {
      title: '100% Private Browser Processing',
      description: `Every ${tool.name} operation runs locally in your browser memory. Zero server uploads or storage.`,
    },
    {
      title: 'Completely Free, No Limits',
      description: 'Use all 200+ NexcTool utilities as often as you need with no accounts, watermarks, or paywalls.',
    },
    {
      title: 'Works Offline Once Loaded',
      description: 'Because processing happens directly on your device, there is no round-trip upload latency.',
    },
    {
      title: 'Clean Cross-Device Interface',
      description: 'Designed for fast everyday workflows on desktop computers, tablets, and mobile browsers.',
    },
  ];

  const faqs = [
    {
      question: `Is ${tool.name} on NexcTool really private?`,
      answer: `Yes. Your file never leaves your device. All browser-supported tools process data directly inside your local browser tab without sending bytes to any external server.`,
    },
    {
      question: `Do I need to install software or create an account to use ${tool.name}?`,
      answer: `No. NexcTool runs directly in modern web browsers on Windows, macOS, Linux, iOS, and Android with zero sign-up required.`,
    },
    {
      question: `Are there file size restrictions for ${tool.name}?`,
      answer: `NexcTool imposes no artificial upload caps because nothing is uploaded. Practical limits depend only on your device’s available browser memory.`,
    },
    {
      question: `Is ${tool.name} free for personal and commercial work?`,
      answer: `Yes, all tools on NexcTool are 100% free to use for both personal and business workflows.`,
    },
  ];

  return { titleTag, metaDescription, steps, features, faqs };
}
