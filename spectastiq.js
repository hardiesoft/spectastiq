import { initTimeline } from "./timeline-wrapper.js";
import { initSpectrogram, colorMaps } from "./spectrogram-renderer.js";
import { initAudio, initAudioPlayer } from "./audio-player.js";
import {mapRange} from "./webgl-drawimage.js";

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
  #spectastiq-timescale-overlay-canvas {
    position: absolute;
    top: 0;
    left: 0;
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
      <canvas height="300" id="user-overlay-canvas"></canvas>
      <canvas height="30" id="spectastiq-timescale-overlay-canvas"></canvas>        
      <canvas height="300" id="spectastiq-overlay-canvas"></canvas>
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

  static observedAttributes = ["src", "height", "time-scale", "frequency-scale", "color-scheme", "colour-scheme"];

  attributeChangedCallback(name, oldValue, newValue) {
    if (this.inited) {
      switch (name) {
        case "src": {
          newValue && this.loadSrc(newValue);
        }
          break;
        case "height": {
          const totalHeight = Number(newValue) || 360;
          this.timelineHeight = Math.min(60, Math.max(44, totalHeight - 200));
          this.spectrogramHeight = totalHeight - this.timelineHeight;
          // Resize.
          this.resizeCanvases(undefined, false);
        }
          break;
        case "time-scale": {
          this.drawTimescale = this.timeScale;
          if (this.drawTimescale) {
            this.redrawTimescaleOverlay();
          } else {
            this.clearTimescaleOverlay();
          }
        }
          break;
        case "frequency-scale": {
          this.drawFrequencyScale = this.frequencyScale;
          if (this.drawFrequencyScale) {
            this.redrawFrequencyScaleOverlay();
          } else {
            this.clearOverlay();
          }
          if (this.drawTimescale) {
            this.redrawTimescaleOverlay();
          }
        }
          break;
        case "color-scheme":
        case "colour-scheme": {
          if (!colorMaps.map((p) => p.toLowerCase()).includes(newValue.toLowerCase())) {
            console.error(
              `Unknown color scheme: ${newValue}. Allowed schemes are any of '${colorMaps.join(
                "', '"
              )}'`
            );
            return;
          }
          while (this.nextPalette().toLowerCase() !== this.colorScheme.toLowerCase()) {
            // Cycle until we get the desired palette
          }
        }
          break;
      }
    }
  }

  listColorSchemes() {
    return colorMaps;
  }

  connectedCallback() {
    this.init();
  }

  disconnectedCallback() {
    this.terminateWorkers && this.terminateWorkers();
    this.terminateWorkers = null;
    this.pause(0).then(() => {
      this.unload();
    });
  }

  get src() {
    return this.getAttribute("src");
  }
  set src(newValue) {
    this.setAttribute("src", newValue);
  }

  get height() {
    return this.getAttribute("height");
  }
  set height(newValue) {
    this.setAttribute("height", newValue);
  }

  get timeScale() {
    if (this.hasAttribute("time-scale")) {
      const scale = this.getAttribute("time-scale");
      return scale !== "false" && scale !== "0" && scale !== null;
    }
    return false;
  }
  set timeScale(newValue) {
    this.setAttribute("time-scale", newValue);
  }

  get frequencyScale() {
    if (this.hasAttribute("frequency-scale")) {
      const scale = this.getAttribute("frequency-scale");
      return scale !== "false" && scale !== "0" && scale !== null;
    }
    return false;
  }
  set frequencyScale(newValue) {
    this.setAttribute("frequency-scale", newValue);
  }
  get colorScheme() {
    return this.getAttribute("color-scheme") || this.getAttribute("colour-scheme");
  }
  set colorScheme(newValue) {
    // TODO: Make sure it's an allowed colour scheme, otherwise throw a warning.
    this.setAttribute("color-scheme", newValue);
  }
  set colourScheme(newValue) {
    // TODO: Make sure it's an allowed colour scheme, otherwise throw a warning.
    this.setAttribute("color-scheme", newValue);
  }

  unload() {
    this.requestAborted = true;
    this.terminateExistingState && this.terminateExistingState();
    this.terminateExistingState = null;
  }

  loadSrc(src) {
    const startTimeOffset = Number(this.getAttribute("start")) || 0;
    const endTimeOffset = Number(this.getAttribute("end")) || 1;
    const requestHeaders = this.getAttribute("request-headers");
    let headers = {};
    if (requestHeaders) {
      try {
        headers = JSON.parse(requestHeaders);
      } catch (e) {
        console.error(`Malformed JSON passed for request headers: ${e}`);
      }
    }
    const { drawTimelineUI, timelineState, setInitialZoom } =
      this.timeline;
    const { audioState, updatePlayhead } = this.audioPlayer;
    const canvas = this.timelineElements.canvas;
    const mapCtx = this.timelineElements.mapCanvas.getContext("webgl2");
    const ctx = canvas.getContext("webgl2");
    const timescaleOverlayContext = this.timelineElements.timescaleCanvas.getContext("2d");
    const userOverlayCtx =
      this.timelineElements.userOverlayCanvas.getContext("2d");
    this.progressBar.setAttribute("value", String(0));

    const MAX_ZOOMED_REGION = 0.8;
    const TEXTURE_HEIGHT = 1024;
    const map = (value, min1, max1, min2, max2) => {
      return min2 + ((value - min1) * (max2 - min2)) / (max1 - min1);
    };
    this.sharedState.interacting = false;
    (async () => {
      if (audioState && audioState.playing) {
        await this.pause(0);
      }
      this.unload();
      this.beginLoad();

      // Download audio file and update the progress bar.
      let fileBytes;
      {
        const chunks = [];
        let receivedLength = 0;
        this.requestAborted = false;
        if (this.abortController) {
          this.abortController.abort("User aborted");
        }
        this.abortController = new AbortController();
        this.abortController.signal.addEventListener("onabort", (e) => {
          this.requestAborted = true;
        });
        const requestInfo = {
          mode: "cors",
          cache: "no-cache",
          method: "get",
          signal: this.abortController.signal,
          headers: {
            ...headers,
          },
        };
        let downloadAudioResponse;
        try {
          downloadAudioResponse = await fetch(src, requestInfo);
          const reader = downloadAudioResponse.body.getReader();
          let expectedLength = parseInt(
            downloadAudioResponse.headers.get("Content-Length"), 10
          );
          if (isNaN(expectedLength)) {
            expectedLength = parseInt(downloadAudioResponse.headers.get("Fallback-Content-Length"), 10);
          }
          if (!isNaN(expectedLength)) {
            if (!this.progressBar.parentElement) {
              this.timelineElements.spectrogramContainer.appendChild(this.progressBar);
            }
          }
          while (!this.requestAborted) {
            const { done, value } = await reader.read();
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
          for (const chunk of chunks) {
            fileBytesReceived.set(chunk, position);
            position += chunk.length;
          }
          fileBytes = fileBytesReceived.buffer;
          const {
            renderRange,
            renderToContext,
            audioFileUrl,
            numAudioSamples,
            invalidateCanvasCaches,
            unloadAudio,
            terminateWorkers,
            cyclePalette,
            persistentSpectrogramState,
          } = await initSpectrogram(
            fileBytes,
            this.persistentSpectrogramState || null
          );
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
          audioState.followPlayhead = false;
          this.persistentSpectrogramState = persistentSpectrogramState;
          this.terminateExistingState = unloadAudio;
          this.terminateWorkers = terminateWorkers;
          this.invalidateCanvasCaches = invalidateCanvasCaches;
          this.renderRange = renderRange;

          const defaultPalette = "Viridis";
          // Select starting palette
          let palette =
            this.colorScheme ||
            defaultPalette;
          if (
            !colorMaps.map((p) => p.toLowerCase()).includes(palette.toLowerCase())
          ) {
            console.error(
              `Unknown color scheme: ${palette}. Allowed schemes are any of '${colorMaps.join(
                "', '"
              )}'`
            );
            palette = defaultPalette;
          }
          let paletteChangeTimeout;
          this.nextPalette = () => {
            this.clearOverlay();
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
              renderToContext(ctx, startZeroOne, endZeroOne, top, bottom);
              renderToContext(mapCtx, 0, 1, 1, 0);
              audioState.progressSampleTime = performance.now();
              updatePlayhead();
              if (this.actualSampleRate) {
                if (this.drawFrequencyScale) {
                  this.redrawFrequencyScaleOverlay();
                } else {
                  this.clearOverlay();
                }
              }
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
            let y = 1 - Math.min(1, Math.max(0, yZeroOne));
            const top = timelineState.top;
            const bottom = timelineState.bottom;
            const maxZoom =
              1024 / (this.timelineElements.canvas.height / devicePixelRatio);
            const maxYZoom = maxZoom * 0.8;
            const minRangeY = 1.0 / maxZoom;
            const rangeY = top - bottom;
            const clampedRangeY = Math.max(rangeY, minRangeY);
            // Prevent divide by zero
            const posY = bottom / Math.max(0.000001, 1.0 - rangeY);
            const mMaxZoom = map(
              clampedRangeY,
              1.0,
              minRangeY,
              1.0,
              1.0 / maxYZoom
            );
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
            return y;
          };
          let cropAmountTop = 0;
          const clampZeroOne = (x) => Math.max(0, Math.min(1, x));
          const redrawTimescaleOverlay = (ctx, startZeroOne, endZeroOne, duration) => {
            ctx.save();
            // Draw a notch every ~second
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            const startTime = startZeroOne * duration;
            const endTime = endZeroOne * duration;
            const startSeconds = Math.floor(startTime);
            const endSeconds = Math.ceil(endTime);
            const zoomLevel = endZeroOne - startZeroOne;

            //const distanceBetweenSecondNotches = (startZeroOne + 1) / duration * ctx.canvas.width / devicePixelRatio;

            // TODO: Fade between.  I guess we want a good way of generalising this pattern of having features fade in at
            //  various zoom levels.  Maybe show every 10 seconds, then every 5, then every 2, then every 1

            //console.log("distanceBetweenSecondNotches", distanceBetweenSecondNotches, drawEveryOtherSecond);
            const tenPx = 10 * devicePixelRatio;
            ctx.font = `${tenPx}px sans-serif`;
            ctx.textAlign = "center";
            let xOpacity = 0.5;
            let pX = 0;
            for (let i = startSeconds; i < endSeconds; i += 1) {
              const oX = mapRange(i / duration, startZeroOne, endZeroOne, 0, 1) * ctx.canvas.width;
              const distanceBetweenSecondNotches = oX - pX;
              pX = oX;
              if (i !== 0) {
                if (this.drawFrequencyScale) {
                  xOpacity = Math.min(0.5, clampZeroOne(mapRange(oX, ctx.canvas.width - tenPx * 10, ctx.canvas.width, 0.5, 0)));
                }
                ctx.fillStyle = `rgba(255, 255, 255, ${xOpacity})`;
                ctx.fillRect(oX, 0, 1, ctx.canvas.height / 2);
                const minDistanceBetweenSecondNotches = 15 * devicePixelRatio;
                // TODO: Generalise this

                // Don't draw labels too close together.
                const isOdd = i % 2 === 1;
                if (!isOdd) {
                    const distance = Math.min(30 * devicePixelRatio, distanceBetweenSecondNotches);
                    const opacity = clampZeroOne(mapRange(distance, 15 * devicePixelRatio, 30 * devicePixelRatio, 0, 1));
                    ctx.fillStyle = `rgba(255, 255, 255, ${xOpacity * opacity})`;
                }
                // TODO: For clips longer than a minute, should have 1m35s notation?
                if (oX + tenPx < ctx.canvas.width) {
                  ctx.fillText(`${i}s`, oX, ctx.canvas.height / 2 + tenPx);
                }
              }
              // TODO: Spacing and zoom level of elements should also be proportionate to how close together they are
              //  because of audio duration.
              const opacity = clampZeroOne(mapRange(1 - zoomLevel, 0.25, 1, 0, 1));
              if (opacity > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${opacity * xOpacity})`;
                for (let j = 1; j < 10; j += 1) {
                  const oX = mapRange((i + (0.1 * j)) / duration, startZeroOne, endZeroOne, 0, 1) * ctx.canvas.width;
                  let h = ctx.canvas.height / 3;
                  if (j === 5) {
                    h += 5 * devicePixelRatio;
                  }
                  ctx.fillRect(oX, 0, 1, h);
                }
              }
            }

            // for (let i = startSeconds; i < endSeconds; i += 1) {
            //   const offsetX = ((i / duration)) * ctx.canvas.width;
            //   console.log(i, offsetX);
            //   ctx.fillRect(offsetX, 0, 1, ctx.canvas.height);
            //
            // }

            ctx.restore();
          };
          this.redrawTimescaleOverlay = () => redrawTimescaleOverlay(timescaleOverlayContext, timelineState.left, timelineState.right, audioState.audioDuration);
          this.clearTimescaleOverlay = () => {
            timescaleOverlayContext.save();
            timescaleOverlayContext.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          }

          this.render = ({ detail: { initialRender, force } }) => {
            if (this.raf) {
              cancelAnimationFrame(this.raf);
              this.raf = undefined;
            }
            this.raf = requestAnimationFrame(() => {
              const startZeroOne = timelineState.left;
              const endZeroOne = timelineState.right;
              const top = timelineState.top;
              const bottom = timelineState.bottom;
              if (this.deferredWidth && ctx.canvas.width !== this.deferredWidth || this.deferredHeight && ctx.canvas.height !== this.deferredHeight) {
                this.resizeCanvases(this.deferredWidth, true);
                this.timelineElements.container.classList.remove("disabled");
              } else if (this.deferredWidth && ctx.canvas.width === this.deferredWidth && this.deferredHeight && ctx.canvas.height === this.deferredHeight) {
                this.timelineElements.container.classList.remove("disabled");
              }

              drawTimelineUI(startZeroOne, endZeroOne, timelineState.currentAction);
              if (!audioState.playing) {
                audioState.progressSampleTime = performance.now();
                updatePlayhead();
              }

              // TODO: Move somewhere sensible
              this.drawTimescale = this.timeScale;
              this.drawFrequencyScale = this.frequencyScale;
              if (this.drawTimescale) {
                redrawTimescaleOverlay(timescaleOverlayContext, startZeroOne, endZeroOne, audioState.audioDuration);
              }

              // Render the stretched version
              renderToContext(ctx, startZeroOne, endZeroOne, top, bottom).then(
                (s) => {
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
                          context: userOverlayCtx,
                        },
                      })
                    );
                  }
                }
              );
              if (initialRender) {
                renderToContext(mapCtx, 0, 1, 1, 0);
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
                      renderToContext(mapCtx, 0, 1, 1, 0).then(() => {
                        if (
                          this.loadingSpinner &&
                          this.loadingSpinner.parentElement
                        ) {
                          this.loadingSpinner.parentElement.removeChild(
                            this.loadingSpinner
                          );
                          this.playerElements.playButton.removeAttribute(
                            "disabled"
                          );
                          this.shadowRoot.dispatchEvent(
                            new CustomEvent("audio-loaded", {
                              composed: true,
                              bubbles: false,
                              cancelable: false,
                              detail: {
                                sampleRate: this.actualSampleRate,
                                duration: numAudioSamples / 48000,
                              },
                            })
                          );
                          this.endLoad();
                        }
                      });
                    }
                    renderToContext(
                      ctx,
                      timelineState.left,
                      timelineState.right,
                      top,
                      bottom
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
                              context: userOverlayCtx,
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
          await initAudio(
            this.playerElements,
            audioFileUrl,
            audioState,
            numAudioSamples / 48000
          );
          // Initial render
          this.render({ detail: { initialRender: true, force: true } });
          // TODO: Animate to region of interest could be replaced by reactive setting of :start :end props?
          this.resizeInited = true;
        } catch (e) {
          console.warn("aborted?", e);
        }
      }
    })();
  }

  beginLoad() {
    if (!this.loadingSpinner.parentElement) {
      this.timelineElements.spectrogramContainer.appendChild(
        this.loadingSpinner
      );
    }
    this.timelineElements.container.classList.add("loading");
  }

  endLoad() {
    this.timelineElements.container.classList.remove("loading");
  }

  init() {

    // TODO: Maybe pass in min/max frequency bounds, so that the view is restricted to AOI?
    // TODO: Get height dynamically from attributes, and respond to changes in height.

    const totalHeight = this.height || 360;
    this.timelineHeight = Math.min(60, Math.max(44, totalHeight - 200));
    this.spectrogramHeight = totalHeight - this.timelineHeight;


    const src = this.getAttribute("src");
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
    const canvasContainer = root.getElementById("canvas-container");
    const miniMapContainer = root.getElementById("mini-map");
    const mapCanvas = root.getElementById("map-canvas");
    const canvas = root.getElementById("spectrogram-canvas");
    const overlayCanvas = root.getElementById("spectastiq-overlay-canvas");
    const timescaleCanvas = root.getElementById("spectastiq-timescale-overlay-canvas");
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
      canvasContainer,
      miniMapContainer,
      userOverlayCanvas,
      overlayCanvas,
      timescaleCanvas,
      timelineUICanvas,
      mainPlayheadCanvas,
      container,
      spectrogramContainer,
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
    const resizeCanvas = (canvas, width, height, forReal = true) => {
      canvas.style.height = `${height}px`;
      canvas.style.width = `${width}px`;
      // NOTE: Defer resizing the backing canvas until we actually want to draw to it, this makes resizes look better.
      if (!this.resizeInited || forReal) {
        canvas.height = height * devicePixelRatio;
        canvas.width = width * devicePixelRatio;
      } else {
        this.deferredWidth = width;
        this.deferredHeight = height;
      }
    };
    overlayCanvas.addEventListener("interaction-begin", () => {
      this.sharedState.interacting = true;
      const startZeroOne = timelineState.left;
      const endZeroOne = timelineState.right;
      // TODO: Await requestAnimationFrame?
      // TODO: Set timeout in case we're interacting but not moving?
      drawTimelineUI(startZeroOne, endZeroOne, timelineState.currentAction);
    });
    overlayCanvas.addEventListener("interaction-target-changed", () => {
      // Canvas-based hit areas changed, so redraw handles for hover states etc.
      const startZeroOne = timelineState.left;
      const endZeroOne = timelineState.right;
      drawTimelineUI(startZeroOne, endZeroOne, timelineState.currentAction);
      updatePlayhead();
    });
    overlayCanvas.addEventListener("interaction-end", () => {
      this.sharedState.interacting = false;
      this.render &&
        this.render({ detail: { initialRender: false, force: true } });
    });

    const clearOverlay = () => {
      const overlayCtx = overlayCanvas.getContext("2d");
      overlayCtx.clearRect(
        0,
        0,
        overlayCtx.canvas.width,
        overlayCtx.canvas.height
      );
    };
    this.clearOverlay = clearOverlay;

    const redrawFrequencyScaleOverlay = (state, actualSampleRate) => {
      const ctx = overlayCanvas.getContext("2d");
      ctx.save();
      const isDarkTheme = state.isDarkTheme;
      state.textMeasurementCache = state.textMeasurementCache || {};
      const maxFreq = actualSampleRate / 2;
      const pixelRatio = window.devicePixelRatio;
      ctx.font = `${10 * pixelRatio}px sans-serif`;
      const divisions = Math.ceil(maxFreq / 1000) + 1;
      const divisionColor = isDarkTheme
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.1)";
      const textColor = isDarkTheme
        ? "rgba(255, 255, 255, 0.5)"
        : "rgba(0, 0, 0, 0.85)";
      //start at bottom?
      ctx.strokeStyle = divisionColor;
      ctx.lineWidth = 1;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = textColor;
      const label = "kHz";
      const labelX = ctx.canvas.width - 4 * devicePixelRatio;
      const kHzLabelY = ctx.canvas.height - 4 * devicePixelRatio;
      ctx.fillText(
        label,
        labelX,
        kHzLabelY
      );
      const cacheKey = `${label}_${pixelRatio}`;
      const textHeight =
        state.textMeasurementCache[cacheKey] ||
        ctx.measureText(label).actualBoundingBoxAscent;
      state.textMeasurementCache[cacheKey] = textHeight;

      let prevY = (kHzLabelY - (textHeight * 0.5)) / pixelRatio;
      const minYOffsetFromMargin = Math.abs(prevY - ctx.canvas.height / pixelRatio);
      for (let i = divisions; i >= 0; i--) {
        const yy = i / divisions;
        const yyy = this.transformY(1 - yy);
        let y = ((1 - yyy) * ctx.canvas.height) / pixelRatio;
        if (prevY - y > 15) {
          ctx.strokeRect(0, y * pixelRatio, ctx.canvas.width - 25 * pixelRatio, 0);
          ctx.textBaseline = "middle";
          const thisFrequency = Math.round((1 - yy) * maxFreq) / 1000;
          const label = `${thisFrequency.toFixed(1).toLocaleString()}`;
          // NOTE: Measure text takes a fair bit on time on chrome on lower powered android devices; cache measurements.
          const cacheKey = `${label}_${pixelRatio}`;
          const textHeight =
            state.textMeasurementCache[cacheKey] ||
            ctx.measureText(label).actualBoundingBoxAscent;
          state.textMeasurementCache[cacheKey] = textHeight;
          const overshootBottom = y + (textHeight + 5 * pixelRatio) * 0.5;
          const overshotBottom =
            overshootBottom >= ctx.canvas.height / pixelRatio;
          if (overshotBottom) {
            ctx.textBaseline = "bottom";
            y -= 2 * pixelRatio;
          }
          // NOTE: fillText is also slow on low-end devices, consider caching text and blitting.
          if (y * pixelRatio > 0) {
            ctx.fillText(
              label,
              ctx.canvas.width - 4 * pixelRatio,
              Math.max(minYOffsetFromMargin * pixelRatio, y * pixelRatio)
            );
            prevY = y;
          }
        }
      }
      ctx.restore();
    };

    overlayCanvas.addEventListener("range-change", (e) => {
      this.render && this.render(e);
    });
    let prevMax = 0;
    let prevMin = 1;
    this.shadowRoot.addEventListener("render", (e) => {
      const yRangeChanged =
        e.detail.range.min !== prevMin || e.detail.range.max !== prevMax;
      prevMax = e.detail.range.max;
      prevMin = e.detail.range.min;
      if (yRangeChanged) {
        this.drawFrequencyScale && clearOverlay();
        this.drawFrequencyScale && redrawFrequencyScaleOverlay(timelineState, this.actualSampleRate);
      }
    });
    this.shadowRoot.addEventListener("audio-loaded", (e) => {
      this.drawFrequencyScale && clearOverlay();
      this.drawFrequencyScale && redrawFrequencyScaleOverlay(timelineState, e.detail.sampleRate);
    });
    overlayCanvas.addEventListener("custom-region-change", (e) => {
      let { left, right, top, bottom } = e.detail;
      left = Math.max(0, left);
      top = Math.max(0, top);
      const x = left * devicePixelRatio;
      const y = top * devicePixelRatio;
      const width = Math.min((right - left) * devicePixelRatio, overlayCanvas.width - x);
      const height = Math.min((bottom - top) * devicePixelRatio, overlayCanvas.height - y);
      clearOverlay();
      this.drawFrequencyScale && redrawFrequencyScaleOverlay(timelineState, this.actualSampleRate);
      const ctx = overlayCanvas.getContext("2d");
      ctx.setLineDash([5 * devicePixelRatio, 5 * devicePixelRatio]);
      ctx.lineWidth = 1 * devicePixelRatio;
      ctx.strokeStyle = "white";
      ctx.strokeRect(x, y, width, height);
    });
    overlayCanvas.addEventListener("custom-region-create", (e) => {
      clearOverlay();
      this.drawFrequencyScale && redrawFrequencyScaleOverlay(timelineState, this.actualSampleRate);
      const { left, right, top, bottom } = e.detail;
      const range = timelineState.right - timelineState.left;
      const startZeroOne =
        timelineState.left +
        (Math.max(0, left / (overlayCanvas.width / devicePixelRatio))) * range;
      const endZeroOne =
        timelineState.left +
        (Math.min(1, right / (overlayCanvas.width / devicePixelRatio))) * range;

      const start = startZeroOne * audioState.audioDuration;
      const end = endZeroOne * audioState.audioDuration;
      const bottomZeroOne = Math.max(0, bottom / (overlayCanvas.height / devicePixelRatio));
      const topZeroOne = Math.min(1, top / (overlayCanvas.height / devicePixelRatio));
      const minFreqHz =
        this.inverseTransformY(bottomZeroOne) * (this.actualSampleRate / 2);
      const maxFreqHz =
        this.inverseTransformY(topZeroOne) * (this.actualSampleRate / 2);

      this.shadowRoot.dispatchEvent(
        new CustomEvent("region-create", {
          detail: {
            start,
            end,
            minFreqHz,
            maxFreqHz,
          },
          bubbles: false,
          composed: true,
          cancelable: false,
        })
      );
    });
    overlayCanvas.addEventListener("double-click", async (e) => {
      await play(e.detail.audioOffsetZeroOne);
    });

    const timeline = initTimeline(
      this.shadowRoot,
      this.sharedState,
      this.timelineElements
    );
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
      redrawFrequencyScaleOverlay,
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
      this.playerElements
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
      play,
      pause
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
      endPlayheadDrag,
    };

    this.play = play;
    this.pause = pause;
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
        // if (setPlaybackTimeToStartOfRegion) {
        //   await setPlaybackOffset(playbackStart);
        // }
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
    this.redrawFrequencyScaleOverlay = () => redrawFrequencyScaleOverlay(timelineState, this.actualSampleRate);

    this.enterRegionCreationMode = () => {
      timelineState.regionCreationMode = true;
      this.timelineElements.spectrogramContainer.classList.add(
        "region-creation-mode"
      );
    };
    this.exitRegionCreationMode = () => {
      timelineState.regionCreationMode = false;
      this.timelineElements.spectrogramContainer.classList.remove(
        "region-creation-mode"
      );
    };

    this.resizeCanvases = (resizedWidth, forReal) => {
      const width = resizedWidth || container.getBoundingClientRect().width;
      this.timelineElements.canvasContainer.style.height = `${this.spectrogramHeight}px`;
      this.timelineElements.miniMapContainer.style.height = `${this.timelineHeight}px`;
      const initialWidth = this.timelineElements.canvas.width;
      resizeCanvas(this.timelineElements.canvas, width, this.spectrogramHeight, forReal);
      resizeCanvas(this.timelineElements.timescaleCanvas, width, Math.max(20, Math.min(30, this.spectrogramHeight / 10)), true);
      resizeCanvas(this.timelineElements.overlayCanvas, width, this.spectrogramHeight, true);
      resizeCanvas(
        this.timelineElements.userOverlayCanvas,
        width,
        this.spectrogramHeight,
        true
      );

      resizeCanvas(this.timelineElements.mapCanvas, width, this.timelineHeight, forReal);
      resizeCanvas(this.timelineElements.timelineUICanvas, width, this.timelineHeight, true);

      resizeCanvas(this.playerElements.mainPlayheadCanvas, width, this.spectrogramHeight, true);
      resizeCanvas(this.playerElements.playheadCanvas, width, this.timelineHeight, true);
      let didChangeWidth = false;
      const willChangeWidth = width * devicePixelRatio !== this.timelineElements.canvas.width;
      if (forReal) {
        didChangeWidth = (this.deferredWidth && this.timelineElements.canvas.width === this.deferredWidth * devicePixelRatio) && this.deferredWidth !== initialWidth;
        this.deferredWidth = undefined;
        this.deferredHeight = undefined;
      }

      const wasTriggeredByResizeEvent = !!resizedWidth;
      if (wasTriggeredByResizeEvent && !!this.resizeInited) {
        {
          const startZeroOne = timelineState.left;
          const endZeroOne = timelineState.right;
          drawTimelineUI(startZeroOne, endZeroOne, timelineState.currentAction);
          if (this.actualSampleRate) {
            this.drawFrequencyScale && clearOverlay();
            this.drawFrequencyScale && redrawFrequencyScaleOverlay(timelineState, this.actualSampleRate);
          }
          if (!audioState.playing) {
            audioState.progressSampleTime = performance.now();
            updatePlayhead();
          }
        }
        this.sharedState.interacting = true;
        clearTimeout(this.sharedState.interactionTimeout);
        this.timelineElements.container.classList.add("disabled");
        this.sharedState.interactionTimeout = setTimeout(() => {
          // TODO: We only want to invalidate the caches if the *backing* size of the spectrogram has changed,
          //  and it needed to be re-rendered.  Otherwise just draw what we have again with no delay.
          //  Worth noting though that our webgl canvases *do* need to be resized at some point, and at that point
          //  we need to re-upload the textures, which can cause a hitch
          if (didChangeWidth) {
            this.invalidateCanvasCaches && this.invalidateCanvasCaches();
            this.renderRange &&
            this.renderRange(0, 1, canvas.width, true).then(() => {
              this.render({detail: {initialRender: true, force: true}});
            });
          } else {
            this.render({detail: {initialRender: true, force: true}});
          }
          this.sharedState.interacting = false;
        }, 300);
      }
    };
    const resizeObserver = new ResizeObserver((entries) => {
      // We'll defer resizing the spectrogram backing canvas until a new spectrogram has been created at the new
      // width and is ready to render.
      this.resizeCanvases(entries[0].contentRect.width, false);
    });
    resizeObserver.observe(container);

    this.inited = true;
    this.shadowRoot.dispatchEvent(
      new Event("ready", {
        composed: true,
        bubbles: false,
        cancelable: false,
      })
    );

    // TODO: Only if we're in the visible viewport, otherwise defer this

    // Initial attributeChangedCallback happens before connectedCallback, so need to load src after initial one-time setup.
    if (src && src !== "null" && src !== "undefined") {
      // NOTE: Vue initially passes `null` or `undefined` to src, which gets stringified.
      this.loadSrc(src);
    }
  }
}
if (!customElements.get("spectastiq-viewer")) {
  customElements.define("spectastiq-viewer", Spectastiq);
}
