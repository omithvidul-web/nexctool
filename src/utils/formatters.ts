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

export function buildToolSeoContent(tool: ToolItem): ToolSeoContent {
  const titleTag = `${tool.name} Free Online - NexcTool`;
  const metaDescription = `${tool.name} online for free with NexcTool. ${tool.description} 100% private—your file never leaves your device.`;

  const isMulti = tool.multiple;
  const isTextOrFile = tool.mode === 'text-or-file';

  const steps = isTextOrFile
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
      ];

  const features = [
    {
      title: '100% Private Browser Processing',
      description: `Every ${tool.name} operation runs locally in your browser memory. Zero server uploads or storage.`,
    },
    {
      title: 'Completely Free, No Limits',
      description: 'Use all 200 NexcTool utilities as often as you need with no accounts, watermarks, or paywalls.',
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
