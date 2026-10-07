import workletUrl from "./rnnoise.worklet.js?worker&url";

export async function createMicrophoneDenoise(ctx: AudioContext): Promise<AudioWorkletNode> {
  if (!ctx.audioWorklet || ctx.sampleRate !== 48_000) throw new Error("unsupported");
  await ctx.audioWorklet.addModule(workletUrl);
  const node = new AudioWorkletNode(ctx, "eclipse-rnnoise", {
    numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
    channelCount: 1, channelCountMode: "explicit",
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 8000);
      const cleanup = () => {
        clearTimeout(timer);
        node.port.onmessage = null;
        node.onprocessorerror = null;
      };
      node.port.onmessage = ({ data }) => {
        if (data === "ready") { cleanup(); resolve(); }
        else if (data === "failed") { cleanup(); reject(new Error("initialization")); }
      };
      node.onprocessorerror = () => { cleanup(); reject(new Error("processor")); };
      node.port.start();
    });
    return node;
  } catch (error) {
    node.port.postMessage("destroy");
    node.disconnect();
    node.port.close();
    throw error;
  }
}
