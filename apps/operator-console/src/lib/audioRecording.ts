const AUDIO_MIME_TYPE_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus'
];

export function canUseLocalSpeechRecording(): boolean {
  return window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
}

export function getPreferredAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  return AUDIO_MIME_TYPE_CANDIDATES.find(candidate => MediaRecorder.isTypeSupported(candidate)) || '';
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('AUDIO_READ_FAILED'));
    reader.readAsDataURL(blob);
  });
}

export function createSpeechAudioUrl(audioBase64: string, audioContentType: string): string {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return URL.createObjectURL(new Blob([bytes], { type: audioContentType }));
}
