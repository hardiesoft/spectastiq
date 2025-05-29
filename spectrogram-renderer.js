import {init, mapRange} from "./webgl-drawimage.js";

const FFT_WIDTH = 2048;
const HEIGHT = FFT_WIDTH / 2; // Height needs to be at half the FFT width.
const numWorkers = (navigator.hardwareConcurrency || 2) - 1;

async function initWorkers(state) {
  if (state.workers.length === 0) {
    const remoteScriptOrigin = cdnScriptOrigin();
    const wasmUrl = remoteScriptOrigin ? `${remoteScriptOrigin}/pkg/spectastiq_bg.wasm` : new URL("./pkg/spectastiq_bg.wasm", import.meta.url);
    const wasmLoader = fetch(wasmUrl);
    const initWorkers = [];
    for (let i = 0; i < numWorkers; i++) {
      const worker = new WorkerPromise(`fft-worker-${i}`, state);
      state.workers.push(worker);
    }
    const wasm = await (await wasmLoader).arrayBuffer();
    for (const worker of state.workers) {
      initWorkers.push(worker.init(wasm));
    }
    await Promise.all(initWorkers);
  }
}

const normalizeAudioBuffer = (buffer) => {
  // Find the peak amplitude in the buffer
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) {
    const sample = Math.abs(buffer[i]);
    if (sample > peak) {
      peak = sample;
    }
  }

  // If there's no signal, return early
  if (peak === 0) return buffer;

  // Calculate the target amplitude for -3 dBFS
  const targetAmplitude = Math.pow(10, (-3) / 20); // Convert dB to linear scale

  // Calculate scaling factor
  const scaleFactor = targetAmplitude / peak;

  // Apply normalization to all samples
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] *= scaleFactor;
  }

  return buffer;
};

const getGainForRegion = (state, minZeroOne, maxZeroOne, minFreqZeroOne, maxFreqZeroOne) => {
  const fullSpectrogram = state.imageDatas[0].imageData;
  const sliceLen = FFT_WIDTH / 2;
  let min = Number.MAX_VALUE;
  let max = 0;
  const numSlices = fullSpectrogram.length / sliceLen;
  const initialNoiseSliceNum = 0;
  const startingSlice = Math.max(initialNoiseSliceNum, Math.floor(numSlices * minZeroOne));
  const endingSlice = Math.floor(numSlices * maxZeroOne);
  const startSliceOffset = startingSlice * sliceLen;
  const endSliceOffset = endingSlice * sliceLen;
  const freqRange = Math.min(sliceLen, state.clip);
  const minFreqCutOff = Math.floor(freqRange * minFreqZeroOne);
  const maxFreqCutOff = Math.floor(freqRange * maxFreqZeroOne);
  for (
    let sliceNum = startSliceOffset;
    sliceNum < endSliceOffset;
    sliceNum += sliceLen
  ) {
    const slice = state.sharedOutputData.slice(sliceNum, sliceNum + sliceLen);
    for (let i = minFreqCutOff; i < maxFreqCutOff; i++) {
      const val = slice[i];
      min = Math.min(min, val);
      max = Math.max(max, val);
    }
  }
  max = Math.min(max, state.max);
  const globalMax = Math.log10(state.max);
  const localMax = Math.log10(max);
  return globalMax / localMax;
};

export const initSpectrogram = async (fileBytes, previousState) => {
  const state = {
    sharedFloatData: undefined,
    sharedOutputData: undefined,
    prevLeft: undefined,
    prevRight: undefined,
    max: undefined,
    imageDatas: [],
    canvasWidth: 0,
    pendingRender: {
      complete: true,
    },
    ctxs: (previousState && previousState.ctxs) || new Map(),
    firstRender: true,
    colorMap: 4,
    cropAmountTop: 0,
    cropAmountBottom: 0,
    workers: (previousState && previousState.workers) || [],
  };
  await initWorkers(state);
  // Normalise the audio to a peak of -3 dBFS
  const audioContext = (previousState && previousState.offlineAudioContext) || new OfflineAudioContext({
    length: 1024 * 1024,
    numberOfChannels: 1,
    sampleRate: 48000,
  });
  // TODO: Decode audio off main thread
  const wavData = await audioContext.decodeAudioData(fileBytes).catch((e) => {
    console.error(e);
  });
  if (!wavData) {
    return {
      error: 'Could not decode audio data',
    };
  }
  const floatData = wavData.getChannelData(0);
  // Sometimes we get malformed files that end in zeros – we want to truncate these.
  let actualEnd = floatData.length;
  for (let i = floatData.length - 1; i > -1; i--) {
    if (floatData[i] !== 0) {
      actualEnd = i;
      break;
    }
  }
  const actualFloatData = normalizeAudioBuffer(floatData.subarray(0, actualEnd));
  const audioFloatData = actualFloatData;
  if (!!window.SharedArrayBuffer) {
    state.sharedFloatData = new Float32Array(
      new SharedArrayBuffer(actualFloatData.byteLength)
    );
    state.sharedFloatData.set(actualFloatData, 0);
  } else {
    state.sharedFloatData = actualFloatData;
  }

  const invalidateCanvasCaches = () => {
    state.imageDatas = [];
    state.pendingRender.complete = true;
    state.max = undefined;
  };

  const terminateWorkers = (state) => {
    for (const worker of state.workers) {
      worker.terminate();
    }
  };

  return {
    renderRange: renderRange(state),
    renderToContext: renderToContext(state),
    audioFloatData,
    invalidateCanvasCaches,
    cyclePalette: () => cyclePalette(state),
    terminateWorkers: () => terminateWorkers(state),
    persistentSpectrogramState: {workers: state.workers, offlineAudioContext: audioContext, ctxs: state.ctxs},
    getGainForRegion: (startZeroOne, endZeroOne, minFreq, maxFreq) => getGainForRegion(state, startZeroOne, endZeroOne, minFreq, maxFreq),
  };
};

const drawImage = (state, ctx) => {
  if (ctx && !state.ctxs.get(ctx)) {
    state.ctxs.set(ctx, init(ctx));
  }
  return state.ctxs.get(ctx).drawImage;
};
const submitTexture = (state, ctx) => {
  if (ctx && !state.ctxs.get(ctx)) {
    state.ctxs.set(ctx, init(ctx));
  }
  return state.ctxs.get(ctx).submitTexture;
};

export const colorMaps = ["Viridis", "Plasma", "Inferno", "Grey"];
const cyclePalette = (state) => {
  state.colorMap++;
  if (state.colorMap >= colorMaps.length) {
    state.colorMap = 0;
  }
  return colorMaps[state.colorMap];
};

const renderRange =
  (state) => async (startZeroOne, endZeroOne, renderWidth, force) => {

    // NOTE: Min width for renders, so that narrow viewports don't get overly blurry images when zoomed in.
    renderWidth = Math.max(1920, renderWidth);
    if (startZeroOne === 0 && endZeroOne === 1) {
      if (state.imageDatas.length) {
        // We've already rendered the fully zoomed out version, no need to re-render
        return new Promise((resolve) => resolve());
      }
    }
    return new Promise((resolve) => {
      if (
        force ||
        startZeroOne !== state.prevLeft ||
        endZeroOne !== state.prevRight ||
        renderWidth !== state.canvasWidth
      ) {
        // Kick off this render of the full visible region at optimal resolution, as long as it's not already processing.
        // Once ready, stretch it as best we can to the visible region.
        if (state.pendingRender.complete || force) {
          state.pendingRender.complete = false;
          // Kick off a render at the current zoom level.
          const length = state.sharedFloatData.length;
          const startSample = Math.floor(length * startZeroOne);
          const endSample = Math.min(length, Math.ceil(length * endZeroOne));

          renderArrayBuffer(
            state,
            renderWidth,
            startZeroOne,
            endZeroOne,
            startSample,
            endSample
          ).then((s) => {
            state.prevLeft = startZeroOne;
            state.canvasWidth = renderWidth;
            state.prevRight = endZeroOne;
            state.pendingRender.complete = true;
            resolve(s);
          });
        } else {
          resolve();
        }
      } else {
        resolve();
      }
    });
  };

const renderToContext =
  (state) =>
    async (
      ctx,
      startZeroOne,
      endZeroOne,
      top,
      bottom
    ) => {
      // Figure out the best intermediate render to stretch.
      // Do we store the final coloured imagedata to stretch, or the FFT array data?

      // Set best match to the full zoomed out range, then look for a better match
      let bestMatch = state.imageDatas[0];
      let exactMatch = false;
      let cropLeft = startZeroOne;
      let cropRight = endZeroOne;

      // Look first for an exact match.
      for (let i = 1; i < state.imageDatas.length; i++) {
        const data = state.imageDatas[i];
        if (
          data.startZeroOne === startZeroOne &&
          data.endZeroOne === endZeroOne
        ) {
          cropLeft = 0;
          cropRight = 1;
          // An exact match
          exactMatch = true;
          bestMatch = data;
          break;
        }
      }
      if (!exactMatch) {
        // Work out whether we're zooming out or in relative to the prev frame, or panning.
        if (state.imageDatas.length === 2) {
          let zoomingIn = false;
          // Look for a more zoomed out match
          for (let i = 1; i < state.imageDatas.length; i++) {
            const data = state.imageDatas[i];
            if (data.startZeroOne <= startZeroOne && data.endZeroOne >= endZeroOne) {
              zoomingIn = true;
              // Work out what proportion of the more zoomed out image we want.
              cropLeft = mapRange(
                startZeroOne,
                data.startZeroOne,
                data.endZeroOne,
                0,
                1
              );
              cropRight = mapRange(
                endZeroOne,
                data.startZeroOne,
                data.endZeroOne,
                0,
                1
              );
              bestMatch = data;
              break;
            }
          }

          if (!zoomingIn) {
            // If zooming out, or panning, synthesise a new image
            const prevImage = state.imageDatas[1];
            const range = endZeroOne - startZeroOne;
            const imageRange = prevImage.endZeroOne - prevImage.startZeroOne;
            const diff = Math.abs(range - imageRange);
            if (diff > 0.000000000001) {
              // "Zooming out"
              // TODO: Better image synthesis of fully zoomed out image, plus existing image that's at a slightly greater
              //  zoom level.
            } else {
              // "Panning"
              // TODO: Better image synthesis of fully zoomed out image + existing portion of image at the zoom level
              //  we're already at.
              // Paste together the relevant bits of each image.  Best to do this in the shader, so we'd pass two
              // textures, and the various offsets of each, maybe with a feather at the edges
            }
          }
        }
      }
      const bitmap = bestMatch;
      if (bitmap) {
        const end = cropLeft + (cropRight - cropLeft);

        const bitmapIndex = bitmap.startZeroOne === 0 && bitmap.endZeroOne === 1 ? 0 : 1;

        // If range is 0..1
        bitmap.submitted = bitmap.submitted || new Map();
        if (!bitmap.submitted.has(ctx)) {
          submitTexture(state, ctx)(bitmapIndex, bitmap.imageData, bitmap.width, bitmap.height);
          bitmap.submitted.set(ctx, true);
        }
        drawImage(state, ctx)(
          bitmapIndex,
          bitmap.normalizationScale,
          cropLeft,
          end,
          top,
          bottom,
          state.cropAmountTop,
          state.cropAmountBottom,
          state.colorMap
        );
        return state;
      }
    };

const cdnScriptOrigin = () => {
  const spectastiqIsLoadedFromCdn = Array.from(document.getElementsByTagName('script'))
    .find(el => el.src.startsWith("https://cdn.jsdelivr.net/gh/hardiesoft/spectastiq"));
  if (spectastiqIsLoadedFromCdn) {
    const cdnStub = spectastiqIsLoadedFromCdn.src.split("/");
    cdnStub.pop();
    return cdnStub.join("/");
  }
  return false;
};

class WorkerPromise {
  constructor(name) {
    this.name = name;
    const remoteScriptOrigin = cdnScriptOrigin();
    if (remoteScriptOrigin) {
      // Use the bundled/non-module version of the worker using importScripts
      this.worker = this.worker = new Worker(
        URL.createObjectURL(
          new Blob(
            [
              `importScripts("${remoteScriptOrigin}/worker-bundle.min.js")`,
            ],
            {type: "text/javascript"}
          )),
        {type: "classic"}
      );
    } else {
      this.worker = new Worker(
        new URL("./spectastiq-worker.js", import.meta.url),
        {type: "module", credentials: "same-origin"}
      );
    }
    this.worker.onmessage = ({data}) => {
      if ((!window.SharedArrayBuffer) && data.output) {
        // Copy outputs back to state.sharedOutputData in the correct offsets
        this.output.subarray(data.offsets.outStart, data.offsets.outEnd).set(data.output, 0);
      }
      // Resolve;
      this.work[data.id](data);
      delete this.work[data.id];
    };
    this.work = {};
    this.id = 0;
  }

  doWork(data, output) {
    if (output) {
      this.output = output;
    }
    return new Promise((resolve) => {
      const jobId = this.id;
      this.id++;
      this.work[jobId] = resolve;
      const message = {id: jobId, ...data};
      try {
        this.worker.postMessage(message);
      } catch (e) {
        console.warn(e);
      }
    });
  }

  init(wasm) {
    return this.doWork({
      type: "Init",
      name: this.name,
      wasm,
    });
  }

  terminate() {
    this.worker.terminate();
  }
}

async function renderArrayBuffer(
  state,
  canvasWidth,
  startZeroOne,
  endZeroOne,
  startSample,
  endSample
) {
  const widthChanged = canvasWidth !== state.canvasWidth;
  const numChunks = numWorkers;
  const canvasChunkWidth = Math.ceil(canvasWidth / numChunks);

  if (!state.sharedOutputData || widthChanged) {
    if (!state.sharedOutputData || canvasWidth > state.canvasWidth) {
      // Realloc on resize
      if (!!window.SharedArrayBuffer) {
        state.sharedOutputData = new Float32Array(
          new SharedArrayBuffer(canvasChunkWidth * numChunks * 4 * HEIGHT)
        );
      } else {
        state.sharedOutputData = new Float32Array(
          new ArrayBuffer(canvasChunkWidth * numChunks * 4 * HEIGHT)
        );
      }
    }
  }

  const audioChunkLength = Math.ceil((endSample - startSample) / numChunks);
  const canvasChunkLength = canvasChunkWidth * (FFT_WIDTH / 2);
  const job = [];
  let chunk = 0;
  let chunkStart = startSample;
  let outStart = 0;
  while (chunkStart < endSample) {
    const chunkEnd = Math.min(chunkStart + audioChunkLength, endSample);
    const outEnd = Math.min(
      outStart + canvasChunkLength,
      state.sharedOutputData.length
    );

    // Pass in 1 FFT window width as the prelude, so that we don't get a period of no output at the beginning of the slice
    const preludeStart = Math.max(0, chunkStart - FFT_WIDTH);
    const preludeEnd = Math.min(preludeStart + FFT_WIDTH, chunkStart);
    const work = {
      type: "Process",
      data: state.sharedFloatData.subarray(chunkStart, chunkEnd),
      prelude: state.sharedFloatData.subarray(preludeStart, preludeEnd),
      offsets: {outStart, outEnd}
    };
    if (!!window.SharedArrayBuffer) {
      work.output = state.sharedOutputData.subarray(outStart, outEnd);
    }
    job.push(
      state.workers[chunk].doWork(work, state.sharedOutputData)
    );
    chunk++;
    outStart += canvasChunkLength;
    chunkStart += audioChunkLength;
  }
  // NOTE: Interestingly, if we support streaming the audio in,
  //  we don't know what the maxes are ahead of time...
  // NOTE: Maxes are what we use to normalise on.

  // NOTE: We may *need* to support streaming audio chunks for longer audio clips?

  // FIXME - Only grab the maxes once, at startup? It's possible there are smaller sounds that aren't captured at that zoom
  //  level, and the max may need to be adjusted though.
  await Promise.all(job);
  if (state.firstRender) {
    // Work out the actual clipping
    state.firstRender = false;
    // NOTE: Try to find the actual sample rate of the audio if it's been resampled.
    const sliceLen = FFT_WIDTH / 2;
    const negs = [];

    // Starting 100 pixels/slices into the audio
    for (
      let j = sliceLen * 100;
      j < state.sharedOutputData.length;
      j += sliceLen
    ) {
      const slice = state.sharedOutputData.slice(j, j + sliceLen);
      for (let i = slice.length - 1; i > -1; i--) {
        // TODO: May need to tune this threshold for very quiet audio files?
        if (slice[i] > 10000) {
          negs.push(i);
          break;
        }
      }
    }
    negs.sort();
    const clip = Math.min(negs[Math.floor(negs.length / 2)], FFT_WIDTH / 2);
    const cClip = FFT_WIDTH / 2 - clip;
    const clipPercent = 1 - (cClip / (FFT_WIDTH / 2));
    state.actualSampleRate = 48000 * clipPercent;
    state.cropAmountTop = 1 - clipPercent;
    state.clip = clip;

  }
  if (!state.max) {
    // Maybe we need to calculate the min/maxes here after cropping anyway?
    // We remove values at the top of the clip less than 10,000
    const sliceLen = FFT_WIDTH / 2;
    let min = Number.MAX_VALUE;
    let max = 0;
    // NOTE: Don't use the very beginning of the file, sometimes they have weird noise
    for (
      let j = 100;
      j < state.sharedOutputData.length;
      j += sliceLen
    ) {
      // NOTE: Crop off noise floor.
      const slice = state.sharedOutputData.slice(j, j + sliceLen);
      // console.log("noise floor", (12 /1024) * state.actualSampleRate);
      // TODO: Work out actual frequency cutoff of around 500hz
      const m = Math.min(slice.length, state.clip);
      for (let i = 12; i < m; i++) {
        const val = slice[i];
        min = Math.min(min, val);
        max = Math.max(max, val);
      }
    }
    state.min = min;
    state.max = max;
  }
  // TODO: Once we know how we're cropping etc, work out min/max values and translate that to a volume scale.
  //  Also allow doing this *again* for a zoomed region of interest.
  // noinspection JSSuspiciousNameCombination
  const nextImageData = {
    startZeroOne,
    endZeroOne,
    imageData: new Float32Array(state.sharedOutputData),
    normalizationScale: state.max,
    width: HEIGHT,
    height: canvasChunkWidth * numChunks,
  };

  if (state.imageDatas.length === 0) {
    state.imageDatas = [nextImageData];
  } else if (state.imageDatas.length === 1) {
    state.imageDatas.push(nextImageData);
  } else {
    state.imageDatas[1] = nextImageData;
  }
  return {
    actualSampleRate: state.actualSampleRate,
    cropAmountTop: state.cropAmountTop,
  };
}
