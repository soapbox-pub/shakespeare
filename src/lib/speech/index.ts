import type { DataType } from '@huggingface/transformers';

export type SpeechModel = 'moonshine' | 'whisper';

/**
 * Speech models, downloaded from Hugging Face on first use and cached by the browser.
 *
 * English uses Moonshine, whose cost grows with the length of the audio, so it
 * keeps up with live speech even without a GPU. Whisper pads everything to 30
 * seconds, which takes several seconds a pass on the CPU, but knows ~100 languages.
 */
type DataTypes = Record<string, DataType>;

export const SPEECH_MODELS: Record<SpeechModel, { name: string; wasm: DataTypes; webgpu: DataTypes }> = {
  moonshine: {
    name: 'onnx-community/moonshine-base-ONNX',
    wasm: { encoder_model: 'fp32', decoder_model_merged: 'q8' },
    webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
  },
  whisper: {
    name: 'onnx-community/whisper-base',
    wasm: { encoder_model: 'q8', decoder_model_merged: 'q8' },
    webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
  },
};
/** Sample rate the speech models expect. */
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
 * Runs Moonshine or Whisper (transformers.js) in a Web Worker, on WebGPU when available.
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
