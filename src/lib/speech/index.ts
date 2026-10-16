/** transformers.js release the worker loads. Keep in step with the devDependency, which provides its types. */
export const TRANSFORMERS_VERSION = '4.3.1';
export const TRANSFORMERS_URL = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}/dist/transformers.min.js`;
/** Whisper model, downloaded from Hugging Face on first use and cached by the browser. */
export const SPEECH_MODEL = 'onnx-community/whisper-base';
/** Sample rate Whisper expects. */
export const SPEECH_SAMPLE_RATE = 16_000;

export interface SpeechRequest {
  id: number;
  /** Mono PCM at `SPEECH_SAMPLE_RATE`. */
  audio: Float32Array;
  /** ISO 639-1 code of the spoken language. */
  language: string;
}

export type SpeechReply =
  | { id: number; progress: number }
  | { id: number; text: string }
  | { id: number; error: string };

interface Pending {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  onProgress?: (percent: number) => void;
}

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./speech.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<SpeechReply>) => {
      const reply = event.data;
      const request = pending.get(reply.id);
      if (!request) return;
      if ('progress' in reply) {
        request.onProgress?.(reply.progress);
        return;
      }
      pending.delete(reply.id);
      if ('error' in reply) request.reject(new Error(reply.error));
      else request.resolve(reply.text);
    };
    worker.onerror = (event) => {
      worker?.terminate();
      worker = undefined;
      for (const request of pending.values()) request.reject(new Error(event.message || 'speech worker crashed'));
      pending.clear();
    };
  }
  return worker;
}

/**
 * Transcribe speech to text on this device.
 *
 * Runs Whisper (transformers.js) in a Web Worker, on WebGPU when available.
 * The model is downloaded on first use, reported through `onProgress` as a
 * percentage; audio never leaves the browser. Languages Whisper doesn't
 * know are transcribed as English.
 */
export function transcribe(audio: Float32Array, language: string, onProgress?: (percent: number) => void): Promise<string> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, audio, language } satisfies SpeechRequest, [audio.buffer]);
  });
}

/** Decode a recording to mono PCM at Whisper's sample rate. */
export async function decodeAudio(blob: Blob): Promise<Float32Array> {
  const context = new AudioContext({ sampleRate: SPEECH_SAMPLE_RATE });
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
    const mono = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
    }
    return mono;
  } finally {
    void context.close();
  }
}
