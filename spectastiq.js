import { initTimeline } from "./timeline-wrapper.js";
import { initSpectrogram, colorMaps } from "./spectrogram-renderer.js";
import { initAudio, initAudioPlayer } from "./audio-player.js";

const template = document.createElement("template");
template.innerHTML = `
<style>
  * {
    box-sizing: border-box;
  }     
  #container {
    background: transparent;                          
    display: flex;
    position: relative;
    flex-direction: column;
    opacity: 1;
    
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;                    
  }
  #container:focus {
    /*outline: none;*/
  }
  #container canvas {
    opacity: 1;
    transition: opacity 0.5s;
  }
  #container.loading {
    touch-action: none;
    user-select: none;
    pointer-events: none; 
  }
  #container.disabled {
    touch-action: none;
    user-select: none;
    pointer-events: none; 
  }
  #container.loading canvas {
    opacity: 0;
  }
  #container.disabled canvas {
    opacity: 0.5;
  }
  #spectrogram-container {
    position: relative;
    cursor: grab;
  }
  #spectrogram-container.cursor-pointer {
    cursor: pointer; 
  }
  #spectrogram-container.dragging {
    cursor: grabbing; 
  }
  #spectrogram-container.region-creation-mode {
    cursor: crosshair;
  }
  #canvas-container {
    position: relative;
    height: 300px;
  }
  #spectrogram-canvas, #spectastiq-overlay-canvas, #user-overlay-canvas {
    position: absolute;
    top: 0;
    left: 0;
    margin: 0;
    padding: 0;
    touch-action: none;
    user-select: none;           
  }  
  #main-playhead-canvas, #user-overlay-canvas, #spectrogram-canvas {
    margin: 0;
    padding: 0;
    position: absolute;
    touch-action: none;
    user-select: none;
    pointer-events: none;
  }
  
  #timeline-ui-canvas.grab {
    cursor: grab;
  }
  #timeline-ui-canvas.resize {
    cursor: ew-resize;
  }
  #timeline-ui-canvas.grabbing {
    cursor: grabbing;
  }
  #playhead-canvas, #map-canvas {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    margin: 0;
    z-index: 1;
    user-select: none;
    touch-action: none;
    pointer-events: none;
  }
  #timeline-ui-canvas {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    margin: 0;
    z-index: 1;
    touch-action: none;
    user-select: none;
    cursor: pointer;
  }
  #mini-map {         
    height: 60px;
    position: relative;
    margin: 0;
    touch-action: none;
    user-select: none;
  }  
  #controls {   
    display: flex;                   
    background: lightslategray;
  }
  #default-controls {
    padding: 10px;
  }
  .control-button {
    all: unset;
    width: 44px;
    height: 44px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: azure;
    border: 1px solid darkslateblue;
    border-radius: 3px;
    color: darkslateblue;
  }
  .play-toggle.paused > .pause-icon {
    display: none;
  }
  .play-toggle:not(.paused) > .play-icon {
    display: none;
  }
  .play-toggle:disabled {
    opacity: 0.5;
  }
     
  .lds-ring {
    display: inline-block;
    position: absolute;
    left: calc(50% - 40px);      
    width: 80px;
    height: 80px;
    top: calc(50% - 40px);             
  }
  #progress-bar {
    display: inline-block;
    position: absolute;
    left: calc(50% - 60px);      
    width: 120px;   
    top: calc(50% + 50px);   
  }
  .lds-ring div {
    box-sizing: border-box;
    display: block;
    position: absolute;
    width: 64px;
    height: 64px;
    margin: 8px;
    border-width: 8px;
    border-style: solid;
    border-radius: 50%;
    animation: lds-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    border-color: #fff transparent transparent transparent;
  }
  .lds-ring div:nth-child(1) {
    animation-delay: -0.45s;
  }
  .lds-ring div:nth-child(2) {
    animation-delay: -0.3s;
  }
  .lds-ring div:nth-child(3) {
    animation-delay: -0.15s;
  }
  @keyframes lds-ring {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
<div id="container">
  <div id="spectrogram-container">
    <div id="canvas-container">
      <canvas height="300" id="spectrogram-canvas"></canvas>        
      <canvas height="300" id="spectastiq-overlay-canvas"></canvas>
      <canvas height="300" id="user-overlay-canvas"></canvas>
      <canvas height="300" id="main-playhead-canvas"></canvas>                
    </div>
    <div id="mini-map">
      <canvas height="60" id="map-canvas"></canvas>     
      <canvas height="60" id="playhead-canvas"></canvas>
      <canvas height="60" id="timeline-ui-canvas"></canvas>         
    </div>
    <progress id="progress-bar" max="100"></progress>
    <div class="lds-ring" id="loading-spinner">
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>   
  </div>
  <div id="controls">
    <slot name="player-controls">
      <div id="default-controls">
        <button class="play-toggle control-button paused" disabled id="play-button">
          <svg class="play-icon" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 384 512"><path fill="currentColor" d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>
          <svg class="pause-icon" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 320 512"><path fill="currentColor" d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"/></svg>
        </button>
      </div>
    </slot>
  </div>
</div>
<audio id="audio"></audio>
`;

export default class Spectastiq extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  inited = false;
  sharedState = { interacting: false };

  static observedAttributes = ["src"];

  attributeChangedCallback(name, oldValue, newValue) {
    if (this.inited) {
      this.loadSrc(newValue);
    }
  }

  connectedCallback() {
    this.init();
  }

  disconnectedCallback() {
    this.terminateWorkers && this.terminateWorkers();
    this.terminateWorkers = null;
  }

  get src() {
    return this.getAttribute("src");
  }
  set src(newValue) {
    this.setAttribute("src", newValue);
  }

  unload() {
    this.terminateExistingState && this.terminateExistingState();
    this.terminateExistingState = null;
  }

  loadSrc(src) {
    const startTimeOffset = Number(this.getAttribute("start")) || 0;
    const endTimeOffset = Number(this.getAttribute("end")) || 1;
    const {
      drawTimelineUI,
      timelineState,
      setInitialZoom,
    } = this.timeline;
    const {
      audioState,
      updatePlayhead,
    } = this.audioPlayer;
    const canvas = this.timelineElements.canvas;
    const mapCtx = this.timelineElements.mapCanvas.getContext("webgl2");
    const ctx = canvas.getContext("webgl2");
    const overlayCtx = this.timelineElements.overlayCanvas.getContext("2d");
    const userOverlayCtx = this.timelineElements.userOverlayCanvas.getContext("2d");

    this.progressBar.setAttribute("value", String(0));

    const MAX_ZOOMED_REGION = 0.8;
    const TEXTURE_HEIGHT = 1024;
    const map = (value, min1, max1, min2, max2) => {
      return min2 + ((value - min1) * (max2 - min2)) / (max1 - min1);
    };
    this.sharedState.interacting = false;
    (async () => {
      // TODO: We don't *need* to reinit workers, only unload them on disconnect.
      performance.mark("unloadStart");
      this.unload();
      performance.mark("unloadEnd");
      performance.measure("unload", "unloadStart", "unloadEnd");
      performance.mark("initSpectrogramStart");
      this.beginLoad();

      // Download audio file and update the progress bar.
      let fileBytes;
      {
        const chunks = [];
        let receivedLength = 0;
        const downloadAudioResponse = await fetch(src);
        const reader = downloadAudioResponse.body.getReader();
        const expectedLength = parseInt(downloadAudioResponse.headers.get("Content-Length"));
        while (true) {
          const { done, value} = await reader.read();
          if (done) {
            break;
          }
          chunks.push(value);
          receivedLength += value.length;
          if (!isNaN(expectedLength)) {
            const progress = receivedLength / expectedLength;
            this.progressBar.setAttribute("value", String(progress * 100));
            if (progress === 1) {
              if (this.progressBar.parentElement) {
                this.progressBar.parentElement.removeChild(this.progressBar);
              }
            }
          }
        }
        const fileBytesReceived = new Uint8Array(receivedLength);
        let position = 0;
        for (let chunk of chunks) {
          fileBytesReceived.set(chunk, position);
          position += chunk.length;
        }
        fileBytes = fileBytesReceived.buffer;
      }

      const {
        renderRange,
        renderToContext,
        audioFileUrl,
        numAudioSamples,
        invalidateCanvasCaches,
        unloadAudio,
        terminateWorkers,
        cyclePalette,
        persistentSpectrogramState
      } = await initSpectrogram(fileBytes, this.persistentSpectrogramState || null);
      performance.mark("initSpectrogramEnd");
      performance.measure("initSpectrogram", "initSpectrogramStart", "initSpectrogramEnd");
      timelineState.numAudioSamples = numAudioSamples;
      timelineState.left = 0;
      timelineState.top = 1;
      timelineState.bottom = 0;
      timelineState.right = 1;
      timelineState.zoomX = 1;
      timelineState.pinchStarted = false;
      timelineState.panStarted = false;
      timelineState.initialPinchXLeftZeroOne = 0;
      timelineState.initialPinchXRightZeroOne = 1;
      timelineState.currentAction = null;
      if (audioState.playing) {
        audioState.togglePlayback();
      }
      audioState.followPlayhead = false;
      this.persistentSpectrogramState = persistentSpectrogramState;
      this.terminateExistingState = unloadAudio;
      this.terminateWorkers = terminateWorkers;
      this.invalidateCanvasCaches = invalidateCanvasCaches;
      this.renderRange = renderRange;

      const defaultPalette = "Viridis";
      // Select starting palette
      let palette = this.getAttribute("color-scheme") || this.getAttribute("colour-scheme") || defaultPalette;
      if (!colorMaps.map(p => p.toLowerCase()).includes(palette.toLowerCase())) {
        console.error(`Unknown color scheme: ${palette}. Allowed schemes are any of '${colorMaps.join("', '")}'`);
        palette = defaultPalette;

      }
      let paletteChangeTimeout;
      this.nextPalette = () => {
        const nextPalette = cyclePalette();
        // Give downstream renderers a moment to adjust to palette changes;
        clearTimeout(paletteChangeTimeout);
        paletteChangeTimeout = setTimeout(() => {
          timelineState.isDarkTheme = nextPalette !== "Grayscale";
          const startZeroOne = timelineState.left;
          const endZeroOne = timelineState.right;
          const top = timelineState.top;
          const bottom = timelineState.bottom;
          drawTimelineUI(startZeroOne, endZeroOne, timelineState.currentAction);
          renderToContext(
            ctx,
            overlayCtx,
            userOverlayCtx,
            this.transformY,
            startZeroOne,
            endZeroOne,
            top,
            bottom,
            true
          );
          renderToContext(
            mapCtx,
            mapCtx,
            null, // userOverlayCtx
            this.transformY,
            0,
            1,
            1,
            0,
            false
          );
          audioState.progressSampleTime = performance.now();
          updatePlayhead();
        }, 10);
        return nextPalette;
      };
      while (this.nextPalette().toLowerCase() !== palette.toLowerCase()) {
        // Cycle until we get the desired palette
      }
      this.transformY = (y) => {
        const top = timelineState.top;
        const bottom = timelineState.bottom;
        // Is the incoming y within the clampedRangeY?
        const maxYZoom =
          (TEXTURE_HEIGHT / (canvas.height / window.devicePixelRatio)) *
          MAX_ZOOMED_REGION;
        const rangeY = top - bottom;
        const minRangeY =
          1 / (TEXTURE_HEIGHT / (canvas.height / window.devicePixelRatio));

        // The input height of the selected region.
        const clampedRangeY = Math.max(rangeY, minRangeY);
        const posY = bottom / Math.max(0.000001, 1 - rangeY);
        const rem = 1 - clampedRangeY;
        const inBottom = rem * posY;
        const inTop = inBottom + clampedRangeY;

        const mMaxZoom = map(clampedRangeY, 1, minRangeY, 1, 1 / maxYZoom);
        const actualHeight = clampedRangeY * (1 / mMaxZoom);
        const remainder = 1 - actualHeight;
        const selectedBottom = remainder * posY;
        const selectedTop = selectedBottom + actualHeight;

        const aboveRange = y > inTop;
        const belowRange = y < inBottom;
        const inRange = y <= inTop && y >= inBottom;
        if (inRange) {
          y = map(y, inBottom, inTop, selectedBottom, selectedTop);
        } else if (belowRange) {
          y = map(y, 0, inBottom, 0, selectedBottom);
        } else if (aboveRange) {
          y = map(y, inTop, 1.0, selectedTop, 1.0);
        }
        return y;
      };
      this.inverseTransformY = (yZeroOne) => {
        // How much to crop of the top and bottom of the spectrogram (used if the sample rate of the audio was different
        // from the sample rate the FFT was performed at, since that leaves a blank space at the top)
        let y = 1 - yZeroOne;
        const cropTop = cropAmountTop;
        const top = timelineState.top;
        const bottom = timelineState.bottom;
        const cropBottom = 1;
        const maxZoom = 1024 / (this.timelineElements.canvas.height / devicePixelRatio);
        const maxYZoom = maxZoom * 0.8;
        const minRangeY = 1.0 / maxZoom;
        const rangeY = top - bottom;
        const clampedRangeY = Math.max(rangeY, minRangeY);
        // Prevent divide by zero
        const posY = bottom / Math.max(0.000001, (1.0 - rangeY));
        const mMaxZoom = map(clampedRangeY, 1.0, minRangeY, 1.0, 1.0 / maxYZoom);
        const actualHeight = clampedRangeY * (1.0 / mMaxZoom);
        const remainder = 1.0 - actualHeight;
        const selectedBottom = remainder * posY;
        const selectedTop = selectedBottom + actualHeight;
        const aboveRange = y > selectedTop;
        const belowRange = y < selectedBottom;
        const inRange = y <= selectedTop && y >= selectedBottom;

        if (inRange) {
          y = map(y, selectedBottom, selectedTop, bottom, top);
        } else if (belowRange) {
          y = map(y, 0.0, selectedBottom, 0.0, bottom);
        } else if (aboveRange) {
          y = map(y, selectedTop, 1.0, top, 1.0);
        }

        y = map(y, 0.0, 1.0, cropTop, cropBottom);
        return y;
      };
      let cropAmountTop = 0;
      this.render = ({ detail: { initialRender, force } }) => {
        if (this.raf) {
          //console.log("requested render", performance.now());
          cancelAnimationFrame(this.raf);
          this.raf = undefined;
        }
        this.raf = requestAnimationFrame(() => {
          //performance.mark("RenderStart");
          const startZeroOne = timelineState.left;
          const endZeroOne = timelineState.right;
          const top = timelineState.top;
          const bottom = timelineState.bottom;

          if (this.deferredWidth && ctx.canvas.width !== this.deferredWidth) {
            this.resizeCanvases(this.deferredWidth, true);
          }

          drawTimelineUI(startZeroOne, endZeroOne, timelineState.currentAction);

          //  FIXME: Doesn't play well with zoom to region of interest.
          if (!audioState.playing) {
            audioState.progressSampleTime = performance.now();
            updatePlayhead();
          }

          // Render the stretched version
          renderToContext(
            ctx,
            overlayCtx,
            userOverlayCtx,
            this.transformY,
            startZeroOne,
            endZeroOne,
            top,
            bottom,
            true
          ).then((s) => {
            if (!!s) {
              this.shadowRoot.dispatchEvent(
                new CustomEvent("render", {
                  bubbles: false,
                  composed: true,
                  cancelable: false,
                  detail: {
                    range: {
                      begin: startZeroOne,
                      end: endZeroOne,
                      min: bottom,
                      max: top,
                    },
                    context: userOverlayCtx
                  },
                })
              );
            }
          });
          if (initialRender) {
            renderToContext(
              mapCtx,
              mapCtx,
              null,
              this.transformY,
              0,
              1,
              1,
              0,
              false
            );
          }

          if (!this.sharedState.interacting || initialRender) {
            // Render the fine detail of the zoom level and then fill it in when available.
            renderRange(startZeroOne, endZeroOne, canvas.width, force).then(
              (rangeCropInfo) => {
                if (rangeCropInfo && rangeCropInfo.cropAmountTop) {
                  cropAmountTop = rangeCropInfo.cropAmountTop;
                  this.actualSampleRate = rangeCropInfo.actualSampleRate;
                }
                if (initialRender) {
                  renderToContext(
                    mapCtx,
                    mapCtx,
                    null,
                    this.transformY,
                    0,
                    1,
                    1,
                    0,
                    false
                  ).then(() => {
                    if (this.loadingSpinner && this.loadingSpinner.parentElement) {
                      this.loadingSpinner.parentElement.removeChild(this.loadingSpinner);
                      this.playerElements.playButton.removeAttribute("disabled");
                      this.shadowRoot.dispatchEvent(
                        new CustomEvent("audio-loaded", {
                          composed: true,
                          bubbles: false,
                          cancelable: false,
                          detail: {
                            sampleRate: this.actualSampleRate,
                            duration: numAudioSamples / 48000,
                          }
                        })
                      );
                      this.endLoad();
                    }
                  });
                }
                renderToContext(
                  ctx,
                  overlayCtx,
                  userOverlayCtx,
                  this.transformY,
                  timelineState.left,
                  timelineState.right,
                  top,
                  bottom,
                  true
                ).then((s) => {
                  if (
                    initialRender &&
                    startTimeOffset !== 0 &&
                    endTimeOffset !== 1
                  ) {
                    // NOTE: If we're doing an initial render at a zoomed in portion, we need to make sure we create
                    //  the full range image first.
                    setInitialZoom(
                      startTimeOffset,
                      endTimeOffset,
                      1,
                      0,
                      initialRender,
                      true
                    );
                  }

                  if (!!s) {
                    this.shadowRoot.dispatchEvent(
                      new CustomEvent("render", {
                        bubbles: false,
                        composed: true,
                        cancelable: false,
                        detail: {
                          range: {
                            begin: startZeroOne,
                            end: endZeroOne,
                            min: bottom,
                            max: top,
                          },
                          context: userOverlayCtx
                        },
                      })
                    );
                  }

                });
              }
            );
          }
        });
      };
      await initAudio(this.playerElements, audioFileUrl, audioState, numAudioSamples / 48000);
      // Initial render
      this.render({ detail: { initialRender: true, force: true } });
      // TODO: Animate to region of interest could be replaced by reactive setting of :start :end props?
      this.resizeInited = true;
    })();
  }

  beginLoad() {
    if (!this.progressBar.parentElement) {
      this.timelineElements.spectrogramContainer.appendChild(this.progressBar);
    }
    if (!this.loadingSpinner.parentElement) {
      this.timelineElements.spectrogramContainer.appendChild(this.loadingSpinner);
    }
    this.timelineElements.container.classList.add("loading");
  }

  endLoad() {
    this.timelineElements.container.classList.remove("loading");
  }

  init(loadedSrc) {
    const src = this.getAttribute("src") || loadedSrc;
    const root = this.shadowRoot;
    if (!this.inited) {
      root.appendChild(template.content.cloneNode(true));
    }
    if (src && !this.inited) {

    } else {
      // TODO: No audio src, show ability to load from disk?
    }

    const container = root.getElementById("container");
    const spectrogramContainer = root.getElementById("spectrogram-container");
    const mapCanvas = root.getElementById("map-canvas");
    const canvas = root.getElementById("spectrogram-canvas");
    const overlayCanvas = root.getElementById("spectastiq-overlay-canvas");
    const userOverlayCanvas = root.getElementById("user-overlay-canvas");
    const playheadCanvas = root.getElementById("playhead-canvas");
    const timelineUICanvas = root.getElementById("timeline-ui-canvas");
    if (!this.loadingSpinner) {
      this.loadingSpinner = root.getElementById("loading-spinner");
      this.loadingSpinner.parentElement.removeChild(this.loadingSpinner);
    }
    if (!this.progressBar) {
      this.progressBar = root.getElementById("progress-bar");
      this.progressBar.parentElement.removeChild(this.progressBar);
    }
    const mainPlayheadCanvas = root.getElementById("main-playhead-canvas");
    const playButton = root.getElementById("play-button");
    const audio = root.getElementById("audio");

    this.timelineElements = {
      mapCanvas,
      canvas,
      userOverlayCanvas,
      overlayCanvas,
      timelineUICanvas,
      mainPlayheadCanvas,
      container,
      spectrogramContainer
    };

    this.playerElements = {
      playheadCanvas,
      mainPlayheadCanvas,
      playButton,
      canvas,
      audio,
      overlayCanvas,
      playheadCanvasCtx: playheadCanvas.getContext("2d"),
      mainPlayheadCanvasCtx: mainPlayheadCanvas.getContext("2d"),
    };
    const resizeCanvas = (canvas, width, height, forReal) => {
      canvas.style.height = `${height}px`;
      // NOTE: Defer resizing the backing canvas until we actually want to draw to it, this makes resizes look better.
      if (!this.resizeInited || forReal) {
        canvas.height = height * devicePixelRatio;
        canvas.width = width * devicePixelRatio;
      } else {
        this.deferredWidth = width;
        this.deferredHeight = height;
      }
      canvas.style.width = `${width}px`;
    };
    overlayCanvas.addEventListener("interaction-begin", () => {
      this.sharedState.interacting = true;
      const startZeroOne = timelineState.left;
      const endZeroOne = timelineState.right;
      // TODO: Await requestAnimationFrame?

      // TODO: Set timeout in case we're interacting but not moving?

      drawTimelineUI(startZeroOne, endZeroOne, timelineState.currentAction);
    });
    overlayCanvas.addEventListener("interaction-end", () => {
      this.sharedState.interacting = false;
      this.render && this.render({ detail: { initialRender: false, force: true } });
    });

    const clearOverlay = () => {
      const overlayCtx = overlayCanvas.getContext("2d");
      overlayCtx.clearRect(
        0,
        0,
        overlayCtx.canvas.width,
        overlayCtx.canvas.height
      );
    }

    const redrawOverlay = (state, actualSampleRate) => {
      if (isNaN(actualSampleRate)) {
        debugger;
      }
      const overlayCtx = overlayCanvas.getContext("2d");
      overlayCtx.save();
      const isDarkTheme = state.isDarkTheme
      state.textMeasurementCache = state.textMeasurementCache || {};
      const maxFreq = actualSampleRate / 2;
      const pixelRatio = window.devicePixelRatio;
      overlayCtx.font = `${10 * pixelRatio}px sans-serif`;
      let prevY = -100;
      const divisions = Math.ceil(maxFreq / 1000) + 1;
      const divisionColor = isDarkTheme ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
      const textColor = isDarkTheme ? "rgba(255, 255, 255, 0.85)" : "rgba(0, 0, 0, 0.85)";
      for (let i = 0; i <= divisions; i++) {
        overlayCtx.beginPath();
        overlayCtx.strokeStyle = divisionColor;
        overlayCtx.lineWidth = 1;
        const yy = i / divisions;
        const yyy = this.transformY(1 - yy);
        let y = ((1 - yyy) * overlayCtx.canvas.height) / pixelRatio;
        if (y - prevY > 15) {
          overlayCtx.strokeRect(
            0,
            y * pixelRatio,
            overlayCtx.canvas.width,
            0
          );
          overlayCtx.fillStyle = textColor;
          overlayCtx.textAlign = "right";
          overlayCtx.textBaseline = "middle";
          const thisFrequency = Math.round((1 - yy) * maxFreq) / 1000;
          const label = `${thisFrequency
            .toFixed(1)
            .toLocaleString()} kHz`;
          // NOTE: Measure text takes a fair bit on time on chrome on lower powered android devices; cache measurements.
          const cacheKey = `${label}_${pixelRatio}`;
          const textHeight = state.textMeasurementCache[cacheKey] || overlayCtx.measureText(label).actualBoundingBoxAscent;
          state.textMeasurementCache[cacheKey]  = textHeight;
          const overshootTop = y - ((textHeight + (5 * pixelRatio)) * 0.5);
          const overshootBottom = y + ((textHeight + (5 * pixelRatio)) * 0.5);
          const overshotTop = overshootTop <= 0;
          const overshotBottom = overshootBottom >= overlayCtx.canvas.height / pixelRatio;
          if (overshotBottom) {
            overlayCtx.textBaseline = "bottom";
          }
          else if (overshotTop) {
            overlayCtx.textBaseline = "top";
            y += (2 * pixelRatio);
          }
          // NOTE: fillText is also slow on low-end devices, consider caching text and blitting.
          overlayCtx.fillText(
            label,
            overlayCtx.canvas.width - 4,
            y * pixelRatio
          );
          prevY = y;
        }
      }
      overlayCtx.restore();
    };

    overlayCanvas.addEventListener("range-change", (e) => {
      this.render && this.render(e);
    });
    let prevMax = 0;
    let prevMin = 1;
    this.shadowRoot.addEventListener("render", (e) => {
      const yRangeChanged = e.detail.range.min !== prevMin || e.detail.range.max !== prevMax;
      prevMax = e.detail.range.max;
      prevMin = e.detail.range.min;
      if (yRangeChanged) {
        clearOverlay();
        redrawOverlay(timelineState, this.actualSampleRate);
      }
    });
    this.shadowRoot.addEventListener("audio-loaded", (e) => {
      console.log("audio loaded", e.detail.sampleRate);
      clearOverlay();
      redrawOverlay(timelineState, e.detail.sampleRate);
    });
    overlayCanvas.addEventListener("custom-region-change", (e) => {
      const { left, right, top, bottom } = e.detail;
      clearOverlay();
      redrawOverlay(timelineState, this.actualSampleRate);
      const ctx = overlayCanvas.getContext("2d");
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "white";
      ctx.strokeRect(left, top, right - left, bottom - top);
    });
    overlayCanvas.addEventListener("custom-region-create", (e) => {
      clearOverlay();
      redrawOverlay(timelineState, this.actualSampleRate);
      const { left, right, top, bottom } = e.detail;
      const range = timelineState.right - timelineState.left;
      const startZeroOne = timelineState.left + (left / (overlayCanvas.width / devicePixelRatio)) * range;
      const endZeroOne = timelineState.left + (right / (overlayCanvas.width / devicePixelRatio)) * range;
      const start = startZeroOne * audioState.audioDuration;
      const end = endZeroOne * audioState.audioDuration;
      const bottomZeroOne = bottom / (overlayCanvas.height / devicePixelRatio);
      const topZeroOne = top / (overlayCanvas.height / devicePixelRatio);
      const minFreqHz = this.inverseTransformY(bottomZeroOne) * (this.actualSampleRate / 2);
      const maxFreqHz = this.inverseTransformY(topZeroOne) * (this.actualSampleRate / 2);
      this.shadowRoot.dispatchEvent(new CustomEvent("region-create", {
        detail: {
          start,
          end,
          minFreqHz,
          maxFreqHz,
        },
        bubbles: false,
        composed: true,
        cancelable: false
      }));
    });

    const timeline = initTimeline(this.shadowRoot, this.sharedState, this.timelineElements);
    const {
      drawTimelineUI,
      timelineState,
      setInitialZoom,
      animateToRange,
      getMaxXZoom,
      getMaxYZoom,
      resetYZoom,
    } = timeline;
    this.timeline = {
      drawTimelineUI,
      timelineState,
      setInitialZoom,
      animateToRange,
      getMaxXZoom,
      getMaxYZoom,
      resetYZoom,
    };

    const player = initAudioPlayer(
      this.shadowRoot,
      this.sharedState,
      this.timeline.timelineState,
      this.playerElements,
    );
    const {
      audioState,
      updatePlayhead,
      setPlaybackOffset,
      setGain,
      setBandPass,
      startPlayheadDrag,
      endPlayheadDrag,
      dragLocalPlayhead,
      dragGlobalPlayhead,
      removeBandPass,
      togglePlayback,
    } = player;

    // TODO: Probably move audio progress to sharedState
    timelineState.audioState = player.audioState;
    timelineState.startPlayheadDrag = startPlayheadDrag;
    timelineState.endPlayheadDrag = endPlayheadDrag;
    timelineState.dragLocalPlayhead = dragLocalPlayhead;
    timelineState.dragGlobalPlayhead = dragGlobalPlayhead;
    this.audioPlayer = {
      audioState,
      updatePlayhead,
      setPlaybackOffset,
      setBandPass,
      removeBandPass,
      startPlayheadDrag,
      endPlayheadDrag
    }

    this.togglePlayback = togglePlayback;
    this.setGain = setGain;

    this.animateToRegionOfInterest = async (start, end, min, max) => {
      const initialStart = timelineState.left;
      const initialEnd = timelineState.right;
      const initialTop = timelineState.top;
      const initialBottom = timelineState.bottom;
      await animateToRange(
        initialStart,
        initialEnd,
        initialTop,
        initialBottom,
        start,
        end,
        max,
        min,
        200,
        (left, right, top, bottom, final) => {
          setInitialZoom(left, right, top, bottom, false, final);
        }
      );
    };

    this.setPlaybackFrequencyBandPass = (minFreq, maxFreq) => {
      setBandPass(minFreq, maxFreq);
    };
    this.removePlaybackFrequencyBandPass = () => removeBandPass();

    this.selectRegionOfInterest = async (start, end, min, max) => {
      {
        const playbackStart = start;
        const centerX = start + (end - start) * 0.5;
        // Pad region out by an additional 5%.
        setPlaybackOffset(playbackStart);
        const maxXZoom = getMaxXZoom();
        const pRange = (end - start) * 1.1;
        const paddedRange = Math.max(1 / maxXZoom, pRange);
        const range = paddedRange / 2;
        start = Math.max(centerX - range, 0);
        if (centerX - range < 0) {
          end = centerX + range + Math.abs(centerX - range);
        } else {
          end = centerX + range;
        }
        start = Math.max(0, start);
        end = Math.min(1, end);
      }
      {
        const maxYZoom = getMaxYZoom();
        // Make sure max - min is at least 1/maxYZoom;
        const minZoomYHeight = 1 / maxYZoom;
        let range = max - min;
        if (range < minZoomYHeight) {
          const centerY = min + range * 0.5;
          min = centerY - minZoomYHeight * 0.5;
          max = centerY + minZoomYHeight * 0.5;
          min = Math.max(0, min);
          max = Math.min(1, max);
          range = max - min;
          if (min === 0 && range < minZoomYHeight) {
            max = minZoomYHeight;
          } else if (max === 1 && range < minZoomYHeight) {
            min = 1 - minZoomYHeight;
          }
        }
      }

      this.timelineElements.overlayCanvas.dispatchEvent(
        new Event("interaction-begin")
      );
      await this.animateToRegionOfInterest(start, end, min, max);
      this.timelineElements.overlayCanvas.dispatchEvent(
        new Event("interaction-end")
      );
    };
    this.resetYZoom = resetYZoom;

    this.enterRegionCreationMode = () => {
      timelineState.regionCreationMode = true;
      this.timelineElements.spectrogramContainer.classList.add('region-creation-mode');
    };
    this.exitRegionCreationMode = () => {
      timelineState.regionCreationMode = false;
      this.timelineElements.spectrogramContainer.classList.remove('region-creation-mode');
    };

    this.resizeCanvases = (resizedWidth, forReal) => {
      const width = resizedWidth || container.getBoundingClientRect().width;
      resizeCanvas(this.timelineElements.canvas, width, 300, forReal);
      resizeCanvas(this.timelineElements.overlayCanvas, width, 300, forReal);
      resizeCanvas(this.timelineElements.userOverlayCanvas, width, 300, forReal);

      resizeCanvas(this.timelineElements.mapCanvas, width, 60, forReal);
      resizeCanvas(this.timelineElements.timelineUICanvas, width, 60, forReal);

      resizeCanvas(this.playerElements.mainPlayheadCanvas, width, 300, forReal);
      resizeCanvas(this.playerElements.playheadCanvas, width, 60, forReal);

      const wasTriggeredByResizeEvent = !!resizedWidth;
      if (wasTriggeredByResizeEvent && !!this.resizeInited) {
        {
          const startZeroOne = timelineState.left;
          const endZeroOne = timelineState.right;
          drawTimelineUI(startZeroOne, endZeroOne, timelineState.currentAction);
          if (!audioState.playing) {
            audioState.progressSampleTime = performance.now();
            updatePlayhead();
          }
        }
        this.sharedState.interacting = true;
        this.timelineElements.container.classList.add("disabled");
        clearTimeout(this.sharedState.interactionTimeout);
        this.sharedState.interactionTimeout = setTimeout(() => {
          this.invalidateCanvasCaches && this.invalidateCanvasCaches();

          // TODO: Might be better to pass the render function into render range, rather than yielding via async?
          //  Probably makes no difference in this instance, since this is truly async via a worker.
          this.renderRange && this.renderRange(0, 1, canvas.width, true).then(() => {
            this.render({ detail: { initialRender: true, force: true } });
            this.timelineElements.container.classList.remove("disabled");
          });
          this.sharedState.interacting = false;
        }, 300);
      }
    };
    const resizeObserver = new ResizeObserver((entries) => {
      this.resizeCanvases(entries[0].contentRect.width);
    });
    resizeObserver.observe(container);

    this.inited = true;
    this.shadowRoot.dispatchEvent(new Event("ready", {
      composed: true,
      bubbles: false,
      cancelable: false,
    }));
    // Initial attributeChangedCallback happens before connectedCallback, so need to load src after initial one-time setup.
    if (src) {
      this.loadSrc(src);
    }
  }
}
if (!customElements.get("spectastiq-viewer")) {
  customElements.define("spectastiq-viewer", Spectastiq);
}
