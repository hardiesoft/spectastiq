import * as spectastiq from './pkg/spectastiq-backend.js';
import {colourMap} from "./colormaps.js";
import {positionHandles} from "./timeline-wrapper.js";

const FFT_WIDTH = 2048;

// const canvas = document.getElementById("canvas");
// canvas.width = window.innerWidth;
// const WIDTH = canvas.width;
//console.log(canvas.width);

const HEIGHT = 1024; // Height needs to be at half the FFT width.
let sharedOutputData;// = new Float32Array(new SharedArrayBuffer(WIDTH * 4 * HEIGHT));
let audioCurrentTimeZeroOne = 0;
//const ctx = canvas.getContext('2d');
const workers = [];
const numWorkers = (navigator.hardwareConcurrency || 2) - 1;
async function initWorkers() {

  // TODO: Share wasm module among workers rather than initing/downloading it for each?

  const _mod = await spectastiq.default("./pkg/spectastic_bg.wasm");
  //console.log(mod);
  spectastiq.init_logger();
  const initWorkers = [];
  for (let i = 0; i < numWorkers; i++) {
    const worker = new WorkerPromise(`fft-worker-${i}`);
    workers.push(worker);
    initWorkers.push(worker.init());
  }
  await Promise.all(initWorkers);
}

// let playing = false;
// let audioBytes = null;
// let audioProgressZeroOne = 0;
// let progressSampleTime = 0;
// let audioDuration = 0;
// let audioStatusPoll;
// let playheadWasInRangeWhenPlaybackStarted = false;



const getAudioObject = (fileBytes) => {
  const audioBytes = new ArrayBuffer(fileBytes.byteLength);
  new Uint8Array(audioBytes).set(new Uint8Array(fileBytes));
  return URL.createObjectURL(new Blob([audioBytes], { type: "audio/wav" }));
};
export const initSpectrogram = async (filePath) => {
  const state = {
    floatData: undefined,
    sharedFloatData: undefined,
    sharedOutputData,
    prevLeft: undefined,
    prevRight: undefined,
    max: undefined,
    imageDatas: [],
    canvasWidth: 0,
    pendingRender: {
      complete: true,
    }
  };

  await initWorkers();
  const fileBytes = await (await fetch(filePath)).arrayBuffer();
  const audioFileUrl = getAudioObject(fileBytes);
  // Copy the audio for playback - ideally do this only if playback is requested
  const audioContext = new OfflineAudioContext({
    length: 1024*1024,
    sampleRate: 48000,
  });
  const wavData = await audioContext.decodeAudioData(fileBytes);
  state.floatData = wavData.getChannelData(0);
  // What's the max zoom?
  // Let's say it's FFT_WIDTH per pixel.

  let f = (state.floatData.length / numWorkers);
  let g = f + (FFT_WIDTH - (f % FFT_WIDTH));
  let k = g * numWorkers;
  state.sharedFloatData = new Float32Array(new SharedArrayBuffer(k * 4));
  state.sharedFloatData.set(state.floatData, 0);

  const invalidateCanvasCaches = () => {
    state.imageDatas = [];
    state.pendingRender.complete = true;
    state.max = undefined;
  }

  return {
    renderRange: renderRange(state),
    renderToContext: renderToContext(state),
    audioFileUrl,
    numAudioSamples: state.floatData.length,
    invalidateCanvasCaches
  };
};

const renderRange = (state) => async (startZeroOne, endZeroOne, renderWidth, force) => {
  return new Promise((resolve) => {
    if (force || startZeroOne !== state.prevLeft || endZeroOne !== state.prevRight || renderWidth !== state.canvasWidth) {
      const length = state.floatData.length;
      // NOTE: Round the start/end UP to a multiple of FFT window size, then clip that extra bit off when rendering.
      // We need to move along 0.5 (it seems) window lengths for things to line up correctly.
      const startSample = Math.floor(length * startZeroOne) + (FFT_WIDTH * 0.5);
      // NOTE: We can go past endSample, because we've extended the sharedFloatBuffer with additional padding.
      const endSample = Math.ceil(length * endZeroOne) + (FFT_WIDTH * 0.5);

      // Kick off this render of the full visible region at optimal resolution, as long as it's not already processing.
      // Once ready, stretch it as best we can to the visible region.
      if (state.pendingRender.complete || force) {
        state.pendingRender.complete = false;
        // Kick off a render at the current zoom level.
        renderArrayBuffer(state, renderWidth, startZeroOne, endZeroOne, startSample, endSample).then(() => {
          // console.log("Got rendered range", startZeroOne, endZeroOne);
          state.prevLeft = startZeroOne;
          state.canvasWidth = renderWidth;
          state.prevRight = endZeroOne;
          state.pendingRender.complete = true;
          resolve();
        });

      } else {
        resolve();
        // Else, use the best composite of existing renders to stretch to the visible region.
        //await renderToContext(state, ctx, startZeroOne, endZeroOne);
        //state.progressSampleTime = performance.now();
        //updatePlayhead(state, ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber);
      }
    }
  });
};

const renderToContext = (state) => async (ctx, startZeroOne, endZeroOne) => {
  //debugger;
  // Figure out the best intermediate render to stretch.
  // Do we store the final coloured imagedata to stretch, or the FFT array data?
  //console.log("Render to context", startZeroOne, endZeroOne);
  const fullRange = state.imageDatas[0];
  //console.log(imageDatas);
  let bestMatch = null;
  let exactMatch = false;
  for (let i = 0; i < state.imageDatas.length; i++) {
    // Find the best match for the range
    let data = state.imageDatas[i];
    if (bestMatch) {
      const dStart = startZeroOne - data.startZeroOne;
      const bmStart = startZeroOne - bestMatch.startZeroOne;
      const dEnd = data.endZeroOne - endZeroOne;
      const bmEnd = bestMatch.endZeroOne - endZeroOne;
      if (dStart < bmStart && dEnd < bmEnd) {
        bestMatch = data;
      }
      // We can take something *more* zoomed out, and use that
    } else {
      bestMatch = fullRange;
    }
    if (data.startZeroOne === startZeroOne && data.endZeroOne === endZeroOne) {
      // An exact match
      exactMatch = true;
      bestMatch = data;
      break;
    }
  }
  //console.log(bestMatch);
  if (bestMatch && exactMatch) {
    //console.log("Exact match", startZeroOne, endZeroOne, bestMatch);
    // //const bitmap = await createImageBitmap(new ImageData(imageData, WIDTH, HEIGHT), 0, 0, WIDTH, Math.round((HEIGHT / 3) * 2), {resizeQuality: "high"});

    //const sX = fullRange.width * startZeroOne; //(1/fullRange.r)
    const sW = bestMatch.width;//(bestMatch.width * bestMatch.r); //* (1/fullRange.r)
    const bitmap = await createImageBitmap(
      new ImageData(bestMatch.imageData, bestMatch.width, bestMatch.height), 0, 0, sW, Math.round((bestMatch.height / 3) * 2), {
        resizeQuality: "high",
        resizeWidth: ctx.canvas.width,
        resizeHeight: ctx.canvas.height
      });
    ctx.drawImage(bitmap, 0, 0);
  } else if (bestMatch) {
    //console.log("best match", bestMatch, startZeroOne, endZeroOne);
    const sX = fullRange.width * startZeroOne; //(1/fullRange.r)
    const sW = (fullRange.width  * endZeroOne) - sX; //* (1/fullRange.r)
    const bitmap = await createImageBitmap(
      new ImageData(fullRange.imageData, fullRange.width, fullRange.height), sX, 0, sW, Math.round((fullRange.height / 3) * 2), {
        resizeQuality: "high",
        resizeWidth: ctx.canvas.width,
        resizeHeight: ctx.canvas.height
      });
    ctx.drawImage(bitmap, 0, 0);


    // Zoom in on the part of the bitmap we care about.
    // const bitmap = await createImageBitmap(new ImageData(
    //   bestMatch.imageData,
    //   bestMatch.width,
    //   bestMatch.height,
    // ),
    //   0,
    //   0,
    //   bestMatch.width,
    //   Math.round((bestMatch.height / 3) * 2),
    //   {resizeQuality: "high", resizeWidth: ctx.canvas.width, resizeHeight: ctx.canvas.height }
    // );
    // ctx.drawImage(bitmap, 0, 0);
    //console.log("No exact match, skipping frame");
  }
  return state;
};
//let py;
const render = (max, sharedOutputData, width, HEIGHT, r) => {
  //console.log(width, HEIGHT);

  // FIXME: Does this actually need to be the height of the full FFT data, or could it just
  //  be the height of the imageData?  I guess we're rendering it at full frequency resolution,
  //  and then can easily just re-render to the imageData it we want to accentuate a particular range?
  //if (!frameBufferView) {
    // FIXME: Resize
  const frameBufferView = new Uint32Array(width * HEIGHT);
  //}
  let scale = 1.0 / max; // Put all the values into 0..1 range
  //let img_len_used = HEIGHT;
  let half_chunk_len = HEIGHT;
  let j = 0;

  //console.log(sharedOutputData.byteLength, sharedFloatData.byteLength, frameBufferView.byteLength);

  // if (!py) {
  //   py = new Float32Array(HEIGHT);
  //   for (let y = 0; y< HEIGHT; y++) {
  //     let p = y / HEIGHT;
  //     let freq = p * img_len_used;
  //     let offset = Math.min(freq, HEIGHT);
  //     py[y] = offset;
  //   }
  // }
  // const cutoff = 1024/3;
  //console.log(cutoff);
  for (let y = 340; y < HEIGHT; y++) {
    // let p = y / HEIGHT;
    // let freq = p * img_len_used;
    // console.log(y, p, freq);
    // if (freq < cutoff) { // Crop off frequency
    //   continue;
    // }
    // TODO(jon): Maybe rather than resampling the input audio after its decoded (slow on FF), we just crop the
    //  audio when rendering?  Of course then FFT is going to be slower, since there are more samples.
    //let offset = py[y];//Math.min(freq, HEIGHT);
    for (let x = 0; x < width; x++) {
      const index = (x * half_chunk_len) + y;
      let val = sharedOutputData[index];
      val = val * scale; // Move into 0..1 range
      // For regular rendering
      val = val * val * val;
      //val = val * val * val * val * val * val;

      // NOTE: There's no reason not to have a deeper colour ramp range than 255 here.
      frameBufferView[j] = colourMap[(val * 255) | 0];
      j++;
    }
  }
  return new Uint8ClampedArray(frameBufferView.buffer);
}

// Is it worth denoising the output?
// Can we do things in a glsl shader?
class WorkerPromise {
  constructor(name) {
    this.name = name;
    this.worker = new Worker("spectastiq-worker.mjs", {type: "module"});
    this.worker.onmessage = ({data}) => {
      // Resolve;
      this.work[data.id](data);
      delete this.work[data.id];
    };
    this.work = {};
    this.id = 0;
  }

  doWork(data) {
    return new Promise((resolve, reject) => {
      const jobId = this.id;
      this.id++;
      this.work[jobId] = resolve;
      this.worker.postMessage({id: jobId, ...data});
    });
  }

  init() {
    return this.doWork({
      type: "Init"
    });
  }
}
const resampleAudioBuffer = async (audioBuffer, targetSampleRate) => {
  return new Promise((resolve, reject) => {
    const numFrames = audioBuffer.length * targetSampleRate / audioBuffer.sampleRate;
    const offlineContext = new OfflineAudioContext(audioBuffer.numberOfChannels, numFrames, targetSampleRate);
    const bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    offlineContext.oncomplete = (event) => resolve(event.renderedBuffer);
    bufferSource.connect(offlineContext.destination);
    bufferSource.start(0);
    offlineContext.startRendering();
  });
};
async function renderArrayBuffer(state, canvasWidth, startZeroOne, endZeroOne, startSample, endSample) {
  const widthChanged = canvasWidth !== state.canvasWidth;
  if (!state.sharedOutputData || widthChanged) {
    if (!state.sharedOutputData || canvasWidth > state.canvasWidth) {
      // Realloc on resize
      state.sharedOutputData = new Float32Array(new SharedArrayBuffer(canvasWidth * 4 * HEIGHT));
    }
  }
  let length = endSample - startSample;
  const numChunks = 1;//numWorkers;
  let cLength = length / numChunks;
  let paddedChunkLength = (cLength + (FFT_WIDTH - (cLength % FFT_WIDTH)));
  const r = (length / (paddedChunkLength * numChunks));
  //console.log("Chunk length", chunkLength, chunkLength % 2048);
  // Init workers:
  // Find an amount of overlap between chunks that works?
  const job = [];
  //console.log("Workers", numWorkers, "chunks", numChunks, sharedFloatData.length / chunkLength);


  // TODO: This should be proportionate to sharedOutputData in length, and then we should render R percentage of it.
  //sharedOutputData = new Float32Array(new SharedArrayBuffer(Math.ceil(WIDTH * (1 / r)) * 4 * HEIGHT));

  for (let chunk = 0; chunk < numChunks; chunk++) {
    const start = startSample + chunk * paddedChunkLength;
    const end = start + paddedChunkLength;
    // HMM, this might actually be quite a bit slower than just slicing up a single array?
    //const sharedOutputData = new Float32Array(new SharedArrayBuffer(Math.ceil(width / numChunks) * 2048 * 4));
    const chunkLen = Math.ceil(canvasWidth / numChunks) * (FFT_WIDTH / 2);
    //console.log("Chunk LEN", chunkLen, (WIDTH / numChunks) * 1024);
    const start2 = chunk * chunkLen;
    const end2 = (chunk * chunkLen) + chunkLen;

    //console.log(chunk, start, end, (end - start) / 2048);

    //console.log(start2, end2);
    // TODO(jon): We may want the different slices of audio to overlap, in which case some copying may
    // be necessary.  Maybe we can just copy the overlapping piece though?
    //console.log("chunk", chunk, end - start, chunkLength);
    //console.log("chunk", chunk, end2 - start2, chunkLen);
    // console.assert(end <= sharedFloatData.length);
    // console.assert(end - start === chunkLength);
    // console.assert(chunkLength % 2048 === 0);

    //console.log(start2, end2, sharedOutputData.length);
    // NOTE(jon): Copy previous 2048 samples as separate cloned array to go at start.

    const preludeStart = Math.max(0, start - FFT_WIDTH);
    const preludeEnd = Math.min(preludeStart + FFT_WIDTH, start);

    // console.log("Chunk ", chunk, start, end, chunkLen, "prelude", preludeStart, preludeEnd);
    // console.log("Chunk ", chunk, "dest", start2, Math.min(end2, sharedOutputData.length));
    // if (end2 > sharedOutputData.length) {
    //   //debugger;
    // }
    // console.log("c len", end - start);
    job.push(workers[chunk].doWork({
      type: "Process",
      data: state.sharedFloatData.subarray(start, end),
      prelude: state.sharedFloatData.slice(preludeStart, preludeEnd),
      output: state.sharedOutputData.subarray(start2, Math.min(end2, state.sharedOutputData.length))
    }));
  }
  //console.log("Dispatching work", performance.now() - sss);

  // NOTE(jon): Interestingly, if we support streaming the audio in,
  //  we don't know what the maxes are ahead of time...

  // NOTE: Maxes are what we use to normalise on.

  // FIXME - Only grab the maxes once, at startup? It's possible there are smaller sounds that aren't captured at that zoom
  //  level, and the max may need to be adjusted though.
  const maxes = await Promise.all(job);
  if (!state.max) {
    state.max = Math.max(...maxes.map(({max}) => max));
  }
  //console.log("MAX", max);
  //max -= 1;
  //console.log("FFt", performance.now() - sss);

  // Cacophony audio, resample, remove noise floor, normalise?
  // NOTE(jon): So for one minute recording at 1440 wide, that's actually already "Full resolution" of the audio...
  // So at that point, a better thing to do is probably just change the y scaling...
  //const renderTime = performance.now();
  // console.log(sharedFloatData.length, floatData.length, sharedOutputData.length);
  // console.log(floatData.length / sharedFloatData.length);
  // console.log((1/r) * sharedFloatData.length);
  // console.log("e vs actual", actualEnd, sharedOutputData.length);
  //console.log("w,h", WIDTH, HEIGHT);
  let width = Math.ceil(canvasWidth * r);
  //imageDatas.push({startZeroOne, endZeroOne, imageData: render(max, sharedOutputData, width, HEIGHT, r), r, width, height: HEIGHT});
  const nextImageData = {
    startZeroOne,
    endZeroOne,
    imageData: render(state.max, state.sharedOutputData, width, HEIGHT, r),
    r,
    width,
    height: HEIGHT
  };

  if (state.imageDatas.length === 0) {
    state.imageDatas = [nextImageData];
  } else if (state.imageDatas.length === 1) {
    state.imageDatas.push(nextImageData);
  } else {
    state.imageDatas[1] = nextImageData;
  }
  //await renderFrame(ctx, sharedOutputData.subarray(0, sharedOutputData.length), max);
  // console.log("Rendering total", performance.now() - renderTime);
  // console.log("Rendering + FFT", performance.now() - sss);
  // TODO(jon): Make a render context/instance, and have a double-buffered scratch buffer there, for rendering
  //  from the current frame, and interpolating until we get the next frame.  Also, we want a giant buffer of different slices
  //  for use at various zoom levels.

  // TODO(jon): Seems like this render step could be faster if done in a webgl shader?
  // TODO(jon): Unnecessary memory copying of these arrays happening here:
}
