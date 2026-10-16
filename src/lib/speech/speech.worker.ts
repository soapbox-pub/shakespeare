import type { AutomaticSpeechRecognitionOutput, ProgressInfo } from '@huggingface/transformers';

import { SPEECH_MODEL, TRANSFORMERS_URL, type SpeechReply, type SpeechRequest } from './index';

type Transformers = typeof import('@huggingface/transformers');

interface Transcriber {
  (audio: Float32Array, options: Record<string, unknown>): Promise<AutomaticSpeechRecognitionOutput>;
  model: { generation_config: { lang_to_id?: Record<string, number> } };
}

let transcriber: Promise<Transcriber> | undefined;

/** Whether WebGPU has an adapter; browsers often expose the API without one. */
async function hasWebGPU(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  try {
    return !!(await gpu?.requestAdapter());
  } catch {
    return false;
  }
}

async function createTranscriber(id: number): Promise<Transcriber> {
  // Loaded from a CDN rather than bundled: it fetches onnxruntime's wasm from there anyway.
  const { pipeline }: Transformers = await import(/* @vite-ignore */ TRANSFORMERS_URL);
  const webgpu = await hasWebGPU();
  const asr = await pipeline('automatic-speech-recognition', SPEECH_MODEL, {
    device: webgpu ? 'webgpu' : 'wasm',
    dtype: webgpu
      ? { encoder_model: 'fp32', decoder_model_merged: 'q4' }
      : { encoder_model: 'q8', decoder_model_merged: 'q8' },
    progress_callback: (info: ProgressInfo) => {
      if (info.status === 'progress_total') {
        self.postMessage({ id, progress: info.progress } satisfies SpeechReply);
      }
    },
  });
  return asr as unknown as Transcriber;
}

self.onmessage = async (event: MessageEvent<SpeechRequest>) => {
  const { id, audio, language } = event.data;
  try {
    if (!transcriber) {
      transcriber = createTranscriber(id);
      transcriber.catch(() => (transcriber = undefined));
    }
    const transcribe = await transcriber;
    // Whisper doesn't detect the language here, so it's told; it assumes English for ones it doesn't know.
    const known = !!transcribe.model.generation_config.lang_to_id?.[`<|${language}|>`];
    const output = await transcribe(audio, {
      language: known ? language : undefined,
      // Whisper hears 30 seconds at a time; longer recordings are split into overlapping chunks.
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    self.postMessage({ id, text: output.text.trim() } satisfies SpeechReply);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) } satisfies SpeechReply);
  }
};
