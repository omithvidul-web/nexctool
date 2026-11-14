export interface VideoCompressionPlan {
  targetWidth: number;
  targetHeight: number;
  videoBitsPerSecond: number;
}

export interface VideoMimeCandidate {
  mime: string;
  ext: 'mp4' | 'webm';
}

export function computeVideoCompressionPlan(input: {
  naturalWidth: number;
  naturalHeight: number;
  fileSizeBytes: number;
  durationSec: number;
  quality: number;
}): VideoCompressionPlan {
  const q = Math.min(95, Math.max(10, Number.isFinite(input.quality) ? input.quality : 70));
  const natW = Math.max(2, input.naturalWidth || 640);
  const natH = Math.max(2, input.naturalHeight || 360);

  let maxLongEdge = Math.max(natW, natH);
  if (q <= 25) {
    maxLongEdge = 640;
  } else if (q <= 45) {
    maxLongEdge = 854;
  } else if (q <= 75) {
    maxLongEdge = 1280;
  } else {
    maxLongEdge = 1920;
  }

  let targetW = natW;
  let targetH = natH;
  const currentLong = Math.max(natW, natH);
  if (currentLong > maxLongEdge) {
    const scale = maxLongEdge / currentLong;
    targetW = natW * scale;
    targetH = natH * scale;
  }

  targetW = Math.max(2, Math.round(targetW / 2) * 2);
  targetH = Math.max(2, Math.round(targetH / 2) * 2);

  const normQ = (q - 10) / 85;
  const qualityCeilingBps = Math.round(160_000 + normQ * normQ * 1_640_000);

  let videoBitsPerSecond = qualityCeilingBps;
  if (input.durationSec > 0.2 && input.fileSizeBytes > 0) {
    const originalTotalBps = (input.fileSizeBytes * 8) / input.durationSec;
    const ratio = 0.18 + normQ * 0.5;
    const relativeBps = Math.round(originalTotalBps * ratio);
    videoBitsPerSecond = Math.max(90_000, Math.min(qualityCeilingBps, relativeBps));
  }

  return {
    targetWidth: targetW,
    targetHeight: targetH,
    videoBitsPerSecond,
  };
}

export function getVideoMimeCandidates(preferMp4: boolean, hasAudio: boolean): VideoMimeCandidate[] {
  if (preferMp4) {
    return hasAudio
      ? [
          { mime: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
          { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
          { mime: 'video/mp4', ext: 'mp4' },
          { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
          { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
          { mime: 'video/webm', ext: 'webm' },
        ]
      : [
          { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
          { mime: 'video/mp4', ext: 'mp4' },
          { mime: 'video/webm;codecs=vp9', ext: 'webm' },
          { mime: 'video/webm;codecs=vp8', ext: 'webm' },
          { mime: 'video/webm', ext: 'webm' },
        ];
  }

  return hasAudio
    ? [
        { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
        { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
        { mime: 'video/webm', ext: 'webm' },
        { mime: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
        { mime: 'video/mp4', ext: 'mp4' },
      ]
    : [
        { mime: 'video/webm;codecs=vp9', ext: 'webm' },
        { mime: 'video/webm;codecs=vp8', ext: 'webm' },
        { mime: 'video/webm', ext: 'webm' },
        { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
        { mime: 'video/mp4', ext: 'mp4' },
      ];
}
