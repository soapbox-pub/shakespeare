import type { AutomaticSpeechRecognitionOutput, ProgressInfo } from '@huggingface/transformers';

import { SPEECH_MODELS, SPEECH_SAMPLE_RATE, TRANSFORMERS_URL, type SpeechModel, type SpeechReply, type SpeechRequest } from './index';

type Transformers = typeof import('@huggingface/transformers');

interface Transcriber {
  (audio: Float32Array, options: Record<string, unknown>): Promise<AutomaticSpeechRecognitionOutput>;
  model: { generation_config: { lang_to_id?: Record<string, number> } };
}

const transcribers = new Map<SpeechModel, Promise<Transcriber>>();

/** Whether WebGPU has an adapter; browsers often expose the API without one. */
async function hasWebGPU(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  try {
    return !!(await gpu?.requestAdapter());
  } catch {
    return false;
  }
}

async function createTranscriber(model: SpeechModel, id: number): Promise<Transcriber> {
  // Loaded from a CDN rather than bundled: it fetches onnxruntime's wasm from there anyway.
  const { pipeline }: Transformers = await import(/* @vite-ignore */ TRANSFORMERS_URL);
  const { name, wasm, webgpu } = SPEECH_MODELS[model];
  const gpu = await hasWebGPU();
  const asr = await pipeline('automatic-speech-recognition', name, {
    device: gpu ? 'webgpu' : 'wasm',
    dtype: gpu ? webgpu : wasm,
    progress_callback: (info: ProgressInfo) => {
      if (info.status === 'progress_total') {
        self.postMessage({ id, progress: info.progress } satisfies SpeechReply);
      }
    },
  });
  // The last total it reports can fall short of 100.
  self.postMessage({ id, progress: 100 } satisfies SpeechReply);
  return asr as unknown as Transcriber;
}

function options(model: SpeechModel, transcribe: Transcriber, audio: Float32Array, language: string): Record<string, unknown> {
  if (model === 'moonshine') {
    // Its pipeline allows 6 tokens per whole second, which is none for a short "Yes."
    return { max_new_tokens: Math.max(10, Math.ceil((audio.length / SPEECH_SAMPLE_RATE) * 6)) };
  }
  // Whisper doesn't detect the language here, so it's told; it assumes English for ones it doesn't know.
  const known = !!transcribe.model.generation_config.lang_to_id?.[`<|${language}|>`];
  return { language: known ? language : undefined };
}

self.onmessage = async (event: MessageEvent<SpeechRequest>) => {
  const { id, audio, language } = event.data;
  const model: SpeechModel = language === 'en' ? 'moonshine' : 'whisper';
  try {
    let transcriber = transcribers.get(model);
    if (!transcriber) {
      transcriber = createTranscriber(model, id);
      transcriber.catch(() => transcribers.delete(model));
      transcribers.set(model, transcriber);
    }
    const transcribe = await transcriber;
    const output = await transcribe(audio, options(model, transcribe, audio, language));
    self.postMessage({ id, text: output.text.trim() } satisfies SpeechReply);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) } satisfies SpeechReply);
  }
};
