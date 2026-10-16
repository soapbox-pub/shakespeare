// A file, not a data: URL, which the CSP doesn't allow scripts from.
import workletUrl from './capture.worklet.js?url&no-inline';
import { SPEECH_SAMPLE_RATE, transcribe } from './index';

/** Voice activity is judged over 30 ms frames. */
const FRAME = SPEECH_SAMPLE_RATE * 0.03;
const ms = (n: number) => Math.round(n / 30);

/** Audio kept from before speech starts, so its first sound isn't clipped. */
const PRE_ROLL_FRAMES = ms(300);
/** A pause this long ends a phrase, which is then transcribed for good. */
const PHRASE_PAUSE_FRAMES = ms(600);
/** Silence this long after speaking ends dictation. */
const END_SILENCE_FRAMES = ms(2000);
/** Dictation ends if nothing is said for this long. */
const NO_SPEECH_FRAMES = ms(8000);
/** Phrases are cut here: Whisper hears at most 30 seconds. */
const MAX_PHRASE_FRAMES = ms(25_000);
/** Phrases with less speech than this are taken for noise; Whisper invents words for those. */
const MIN_SPEECH_FRAMES = ms(240);
/** New audio needed before a phrase is transcribed again while it's being spoken. */
const INTERIM_FRAMES = ms(500);

export interface DictationOptions {
  /** ISO 639-1 code of the spoken language. */
  language: string;
  /** The transcript so far; the last phrase may still change. */
  onText: (text: string) => void;
  /** The microphone has closed, and the last phrases are being transcribed. */
  onFinishing: () => void;
  /** The final transcript. */
  onEnd: (text: string) => void;
  onError: (error: Error) => void;
  /** Speech model download, as a percentage. */
  onProgress?: (percent: number) => void;
}

interface Phrase {
  frames: Float32Array[];
  speechFrames: number;
  /** Frames since speech was last heard. */
  silentFrames: number;
  text: string;
  /** Frames at the last interim transcription. */
  transcribedFrames: number;
}

/**
 * Live dictation: transcribes while you speak, and stops when you're done.
 *
 * Microphone audio is split into phrases at pauses by a simple energy-based
 * voice activity detector. The phrase being spoken is re-transcribed as it
 * grows, and transcribed once more when it ends. Everything runs locally
 * (see `transcribe`).
 */
export class Dictation {
  private phrases: Phrase[] = [];
  private current?: Phrase;
  private preRoll: Float32Array[] = [];
  private pending = new Float32Array(0);
  private noiseFloor?: number;
  private heardSpeech = false;
  private silentFrames = 0;
  private finals: Phrase[] = [];
  private busy = false;
  private stopped = false;
  private cancelled = false;

  private constructor(
    private options: DictationOptions,
    private stream: MediaStream,
    private context: AudioContext,
  ) {}

  /** Open the microphone and start listening. */
  static async start(options: DictationOptions): Promise<Dictation> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    // The microphone's own rate: Firefox can't connect a stream to a context at another rate.
    const context = new AudioContext();
    try {
      await context.audioWorklet.addModule(workletUrl);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
      throw error;
    }
    const dictation = new Dictation(options, stream, context);
    const resample = resampler(context.sampleRate / SPEECH_SAMPLE_RATE);
    const node = new AudioWorkletNode(context, 'capture');
    node.port.onmessage = (event: MessageEvent<Float32Array>) => dictation.push(resample(event.data));
    context.createMediaStreamSource(stream).connect(node);
    return dictation;
  }

  /** Stop listening, and finish transcribing what was said. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.stream.getTracks().forEach((track) => track.stop());
    void this.context.close();
    if (this.current) this.endPhrase();
    if (!this.cancelled) this.options.onFinishing();
    this.pump();
  }

  /** Stop without reporting anything further. */
  cancel(): void {
    this.cancelled = true;
    this.stop();
  }

  private push(samples: Float32Array): void {
    if (this.stopped) return;
    const audio = concat([this.pending, samples]);
    let offset = 0;
    for (; offset + FRAME <= audio.length && !this.stopped; offset += FRAME) {
      this.frame(audio.slice(offset, offset + FRAME));
    }
    this.pending = audio.slice(offset);
  }

  private frame(frame: Float32Array): void {
    const speech = this.isSpeech(frame);
    this.silentFrames = speech ? 0 : this.silentFrames + 1;
    if (speech) this.heardSpeech = true;

    if (!this.current) {
      this.preRoll.push(frame);
      if (this.preRoll.length > PRE_ROLL_FRAMES) this.preRoll.shift();
      if (speech) {
        this.current = { frames: this.preRoll, speechFrames: 0, silentFrames: 0, text: '', transcribedFrames: 0 };
        this.phrases.push(this.current);
        this.preRoll = [];
      }
    } else {
      this.current.frames.push(frame);
    }

    if (this.current) {
      const phrase = this.current;
      if (speech) {
        phrase.speechFrames++;
        phrase.silentFrames = 0;
      } else {
        phrase.silentFrames++;
      }
      if (phrase.silentFrames >= PHRASE_PAUSE_FRAMES || phrase.frames.length >= MAX_PHRASE_FRAMES) {
        this.endPhrase();
      }
    }

    if (this.silentFrames >= (this.heardSpeech ? END_SILENCE_FRAMES : NO_SPEECH_FRAMES)) {
      this.stop();
      return;
    }
    this.pump();
  }

  /** Compare the frame's loudness with the background noise, which is tracked as it changes. */
  private isSpeech(frame: Float32Array): boolean {
    let sum = 0;
    for (const sample of frame) sum += sample * sample;
    const rms = Math.sqrt(sum / frame.length);
    const floor = this.noiseFloor ?? rms;
    const speech = rms > Math.max(floor * 3, 0.008);
    // Falls quickly to quieter noise, rises slowly to louder noise, and ignores speech.
    if (rms < floor) this.noiseFloor = floor * 0.8 + rms * 0.2;
    else if (!speech) this.noiseFloor = floor * 0.98 + rms * 0.02;
    else this.noiseFloor = floor;
    return speech;
  }

  private endPhrase(): void {
    const phrase = this.current!;
    this.current = undefined;
    // Keep a little of the trailing silence, as with the leading silence.
    const trailing = Math.max(0, phrase.silentFrames - PRE_ROLL_FRAMES);
    phrase.frames = phrase.frames.slice(0, phrase.frames.length - trailing);
    if (phrase.speechFrames < MIN_SPEECH_FRAMES) {
      this.phrases = this.phrases.filter((p) => p !== phrase);
      this.emit();
    } else {
      this.finals.push(phrase);
    }
  }

  /** Run one transcription at a time: finished phrases first, then the one being spoken. */
  private pump(): void {
    if (this.busy || this.cancelled) return;

    const final = this.finals.shift();
    const interim = this.current && this.current.speechFrames >= MIN_SPEECH_FRAMES
      && this.current.frames.length - this.current.transcribedFrames >= INTERIM_FRAMES
      ? this.current
      : undefined;
    const phrase = final ?? interim;

    if (!phrase) {
      if (this.stopped && !this.current) this.options.onEnd(this.text());
      return;
    }

    this.busy = true;
    phrase.transcribedFrames = phrase.frames.length;
    transcribe(concat(phrase.frames), this.options.language, this.options.onProgress)
      .then((text) => {
        // Cut off mid-word, a phrase can send the model round in circles; the next pass usually recovers.
        if (final || !loops(text)) {
          phrase.text = clean(text);
          this.emit();
        }
        this.busy = false;
        this.pump();
      })
      .catch((error: unknown) => {
        this.busy = false;
        if (this.cancelled) return;
        this.cancel();
        this.options.onError(error instanceof Error ? error : new Error(String(error)));
      });
  }

  private text(): string {
    return this.phrases.map((phrase) => phrase.text).reduce(joinText, '');
  }

  private emit(): void {
    if (!this.cancelled) this.options.onText(this.text());
  }
}

/**
 * Append dictated text to `text`, with a space between. Speech models
 * capitalize each phrase, so one that continues a sentence is lowercased.
 */
export function joinText(text: string, next: string): string {
  if (!next) return text;
  if (!text.trim()) return text + next;
  const continues = !/[.!?]\s*$/.test(text) && /^[A-Z][a-z]/.test(next) && !/^I\b/.test(next);
  return text + (/\s$/.test(text) ? '' : ' ') + (continues ? next[0].toLowerCase() + next.slice(1) : next);
}

/** Whisper marks sounds like `[Music]` or `(laughs)`; they aren't dictation. */
function clean(text: string): string {
  return text.replace(/\[[^\]]*\]|\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

/** Whether a run of up to four words repeats three times in a row. */
function loops(text: string): boolean {
  return /\b(\w+(?:\W+\w+){0,3})(?:\W+\1\b){2,}/i.test(text);
}

function concat(arrays: Float32Array[]): Float32Array {
  const result = new Float32Array(arrays.reduce((length, array) => length + array.length, 0));
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}

/** Streaming linear-interpolation resampler, by `ratio` input samples per output sample. */
function resampler(ratio: number): (input: Float32Array) => Float32Array {
  let previous = 0;
  // Position in the current input; -1 is the last sample of the previous input.
  let position = 0;
  return (input) => {
    const output: number[] = [];
    const sample = (i: number) => (i < 0 ? previous : input[i]);
    while (position <= input.length - 1) {
      const i = Math.floor(position);
      const fraction = position - i;
      output.push(fraction === 0 ? sample(i) : sample(i) * (1 - fraction) + sample(i + 1) * fraction);
      position += ratio;
    }
    position -= input.length;
    if (input.length > 0) previous = input[input.length - 1];
    return Float32Array.from(output);
  };
}
