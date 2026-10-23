// Enregistrement en temps réel du canvas et du son (MediaRecorder).

// Seuls les types MP4 qui nomment H.264 sont retenus : certains navigateurs acceptent « video/mp4 »
// mais y écrivent du VP9, que TikTok et l'iPhone lisent mal.
const FORMATS = [
  ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'mp4'],
  ['video/mp4;codecs=avc1,mp4a.40.2', 'mp4'],
  ['video/webm;codecs=vp9,opus', 'webm'],
  ['video/webm;codecs=vp8,opus', 'webm'],
  ['video/webm', 'webm'],
];

export function pickRecorderFormat() {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
  for (const [mime, ext] of FORMATS) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return null;
}

export function startRecording(canvas, audioStream, format, fps = 60) {
  const video = canvas.captureStream(fps);
  const stream = new MediaStream([...video.getVideoTracks(), ...audioStream.getAudioTracks()]);
  const recorder = new MediaRecorder(stream, {
    mimeType: format.mime,
    videoBitsPerSecond: 14_000_000,
    audioBitsPerSecond: 192_000,
  });
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.start(500);
  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: format.mime.split(';')[0] }));
        };
        recorder.stop();
      }),
  };
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
