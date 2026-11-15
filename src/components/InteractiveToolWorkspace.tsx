import { lazy, Suspense } from 'react';
import type { ToolItem } from '../data/tools';

const QrCodeTool = lazy(() => import('./tools/QrCodeTool').then((m) => ({ default: m.QrCodeTool })));
const FaviconPackTool = lazy(() =>
  import('./tools/FaviconPackTool').then((m) => ({ default: m.FaviconPackTool }))
);
const ImageBlurRedactorTool = lazy(() =>
  import('./tools/ImageBlurRedactorTool').then((m) => ({ default: m.ImageBlurRedactorTool }))
);
const ImageCollageTool = lazy(() =>
  import('./tools/ImageCollageTool').then((m) => ({ default: m.ImageCollageTool }))
);
const InvoicePdfTool = lazy(() =>
  import('./tools/InvoicePdfTool').then((m) => ({ default: m.InvoicePdfTool }))
);
const ImageOcrTool = lazy(() =>
  import('./tools/ImageOcrTool').then((m) => ({ default: m.ImageOcrTool }))
);
const ScreenVoiceRecorderTool = lazy(() =>
  import('./tools/ScreenVoiceRecorderTool').then((m) => ({ default: m.ScreenVoiceRecorderTool }))
);
const SubtitleTool = lazy(() =>
  import('./tools/SubtitleTool').then((m) => ({ default: m.SubtitleTool }))
);
const SocialVideoResizerTool = lazy(() =>
  import('./tools/SocialVideoResizerTool').then((m) => ({ default: m.SocialVideoResizerTool }))
);
const RingtoneMakerTool = lazy(() =>
  import('./tools/RingtoneMakerTool').then((m) => ({ default: m.RingtoneMakerTool }))
);
const FileCryptoTool = lazy(() =>
  import('./tools/FileCryptoTool').then((m) => ({ default: m.FileCryptoTool }))
);
const JwtDecoderTool = lazy(() =>
  import('./tools/JwtDecoderTool').then((m) => ({ default: m.JwtDecoderTool }))
);
const PasswordUuidTool = lazy(() =>
  import('./tools/PasswordUuidTool').then((m) => ({ default: m.PasswordUuidTool }))
);
const ColorPaletteContrastTool = lazy(() =>
  import('./tools/ColorPaletteContrastTool').then((m) => ({ default: m.ColorPaletteContrastTool }))
);
const DataChartTool = lazy(() =>
  import('./tools/DataChartTool').then((m) => ({ default: m.DataChartTool }))
);
const TimestampCronTool = lazy(() =>
  import('./tools/TimestampCronTool').then((m) => ({ default: m.TimestampCronTool }))
);

interface InteractiveToolWorkspaceProps {
  tool: ToolItem;
}

export function InteractiveToolWorkspace({ tool }: InteractiveToolWorkspaceProps) {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading interactive workspace...
        </div>
      }
    >
      {tool.interactiveKind === 'qr-code' && <QrCodeTool />}
      {tool.interactiveKind === 'favicon-pack' && <FaviconPackTool />}
      {tool.interactiveKind === 'image-blur' && <ImageBlurRedactorTool />}
      {tool.interactiveKind === 'image-collage' && <ImageCollageTool />}
      {tool.interactiveKind === 'invoice-pdf' && <InvoicePdfTool />}
      {tool.interactiveKind === 'image-ocr' && <ImageOcrTool />}
      {tool.interactiveKind === 'screen-voice-recorder' && <ScreenVoiceRecorderTool />}
      {tool.interactiveKind === 'subtitle-tool' && <SubtitleTool />}
      {tool.interactiveKind === 'social-video-pad' && <SocialVideoResizerTool />}
      {tool.interactiveKind === 'ringtone-maker' && <RingtoneMakerTool />}
      {tool.interactiveKind === 'file-crypto' && <FileCryptoTool />}
      {tool.interactiveKind === 'jwt-decoder' && <JwtDecoderTool />}
      {tool.interactiveKind === 'password-uuid' && <PasswordUuidTool />}
      {tool.interactiveKind === 'color-palette' && <ColorPaletteContrastTool />}
      {tool.interactiveKind === 'data-chart' && <DataChartTool />}
      {tool.interactiveKind === 'timestamp-cron' && <TimestampCronTool />}
    </Suspense>
  );
}
