// Forwards microphone audio to the main thread in batches, rather than one message per 128-frame render quantum.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.length = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    if (channels && channels.length > 0) {
      const frames = channels[0].length;
      for (let i = 0; i < frames; i++) {
        let sum = 0;
        for (const channel of channels) sum += channel[i];
        this.buffer[this.length++] = sum / channels.length;
        if (this.length === this.buffer.length) {
          this.port.postMessage(this.buffer, [this.buffer.buffer]);
          this.buffer = new Float32Array(2048);
          this.length = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('capture', CaptureProcessor);
