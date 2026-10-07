import { Rnnoise } from "../vendor/rnnoise/rnnoise.js";

// RNNoise consumes 480 PCM16-scale samples at 48 kHz; AudioWorklet supplies
// 128 normalized samples. Keep a bounded FIFO, never post microphone data.
class EclipseDenoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.closed = false;
    this.enabled = false;
    this.frame = new Float32Array(480);
    this.queue = new Float32Array(960);
    this.position = 0;
    this.read = 0;
    this.write = 0;
    this.available = 0;
    this.port.onmessage = ({ data }) => {
      if (data === "destroy") {
        this.closed = true;
        this.state?.destroy();
        this.state = undefined;
        this.port.close();
      } else if (typeof data?.enabled === "boolean" && data.enabled !== this.enabled) {
        this.enabled = data.enabled;
        this.position = this.read = this.write = this.available = 0;
        this.frame.fill(0);
        this.queue.fill(0);
        // Mute/PTT must also discard the model's delayed speech, not replay it
        // when the published track is enabled again.
        if (!this.enabled && this.model) {
          this.state?.destroy();
          this.state = this.model.createDenoiseState();
        }
      }
    };
    void Rnnoise.load().then(model => {
      if (this.closed) return;
      if (model.frameSize !== 480 || sampleRate !== 48000) throw new Error("format");
      this.model = model;
      this.state = model.createDenoiseState();
      this.port.postMessage("ready");
    }).catch(() => this.fail());
  }

  fail() {
    this.enabled = false;
    this.state?.destroy();
    this.state = undefined;
    this.port.postMessage("failed");
  }

  process(inputs, outputs) {
    if (this.closed) return false;
    const out = outputs[0]?.[0];
    if (!out) return true;
    out.fill(0);
    const input = inputs[0]?.[0];
    if (!this.enabled || !this.state || !input) return true;
    try {
      for (let i = 0; i < out.length; i++) {
        this.frame[this.position++] = (input[i] || 0) * 32768;
        if (this.position === 480) {
          this.state.processFrame(this.frame);
          this.position = 0;
          for (let j = 0; j < 480; j++) {
            this.queue[this.write] = this.frame[j] / 32768;
            this.write = (this.write + 1) % this.queue.length;
          }
          this.available += 480;
        }
        if (this.available > 0) {
          out[i] = this.queue[this.read];
          this.read = (this.read + 1) % this.queue.length;
          this.available--;
        }
      }
    } catch {
      out.fill(0);
      this.fail();
    }
    return true;
  }
}

registerProcessor("eclipse-rnnoise", EclipseDenoiseProcessor);
