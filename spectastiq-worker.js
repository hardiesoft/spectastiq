import {initSync, FftContext} from "./pkg/spectastiq.js";
import {USE_SHARED_ARRAY_BUFFER} from "./spectrogram-renderer.js";
let fftContext;

let output;
const minMax = new Float32Array([0]);
self.onmessage = async ({data}) => {
  if (data && data.type === "Process") {
    const useSharedArrayBuffer = USE_SHARED_ARRAY_BUFFER && self.SharedArrayBuffer;
    let s = performance.now();
    minMax[0] = 0;
    if (!useSharedArrayBuffer) {
      const outputLength = data.offsets.outEnd - data.offsets.outStart;
      if (!output || output && output.length !== outputLength) {
        output = new Float32Array(outputLength);
      }
      data.output = output;
    }
    fftContext.processAudio(minMax, data.prelude, data.data, data.output);
    const time = performance.now() - s;
    const message = {
      time,
      id: data.id,
      n: self.name,
      max: minMax[0],
      offsets: data.offsets
    };
    if (!useSharedArrayBuffer) {
      message.output = data.output;
    }
    self.postMessage(message);
  } else if (data && data.type === "Init") {
    initSync({ module: data.wasm });
    self.name = data.name;
    fftContext = FftContext.new();
    self.postMessage({
      id: data.id,
      m: "Inited",
      n: data.name
    });
  }
}
