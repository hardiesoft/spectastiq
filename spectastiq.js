import {initTimeline} from "./timeline-wrapper.js";
import {initSpectrogram} from "./spectrogram-renderer.js";
import {initAudio, initAudioPlayer, updatePlayhead} from "./audio-player.js";

class Spectastiq extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  connectedCallback() {

    const src = this.getAttribute("src");
    const container = document.createElement("div");
    container.setAttribute("class", "container");
    const canvas = document.createElement("canvas");
    canvas.setAttribute("class", "canvas");
    canvas.setAttribute("height", "300");
    const mainPlayheadCanvas = document.createElement("canvas");
    mainPlayheadCanvas.setAttribute("class", "main-playhead-canvas");
    mainPlayheadCanvas.setAttribute("height", "300");
    const mainPlayhead = document.createElement("div");
    mainPlayhead.setAttribute("class", "main-playhead");
    const mainPlayheadScrubber = document.createElement("div");
    mainPlayheadScrubber.setAttribute("class", "main-playhead-scrubber");
    const mainPlayheadScrubberVisible = document.createElement("div");

    const miniMap = document.createElement("div");
    miniMap.setAttribute("class", "mini-map");
    const mapCanvas = document.createElement("canvas");
    mapCanvas.setAttribute("class", "map-canvas");
    mapCanvas.setAttribute("height", "60");
    const playheadCanvas = document.createElement("canvas");
    playheadCanvas.setAttribute("class", "playhead-canvas");
    playheadCanvas.setAttribute("height", "60");
    const leftOfHandle = document.createElement("div");
    leftOfHandle.setAttribute("class", "left-of-handle");
    const handle = document.createElement("div");
    handle.setAttribute("class", "handle");
    const handleLeft = document.createElement("div");
    handleLeft.setAttribute("class", "handle-left");
    const handleLeftInner = document.createElement("div");
    handleLeftInner.setAttribute("class", "inner-handle-left");
    const handleLeftVisible = document.createElement("div");

    const handleRight = document.createElement("div");
    handleRight.setAttribute("class", "handle-right");
    const handleRightInner = document.createElement("div");
    handleRightInner.setAttribute("class", "inner-handle-right");
    const handleRightVisible = document.createElement("div");
    const rightOfHandle = document.createElement("div");
    rightOfHandle.setAttribute("class", "right-of-handle");
    const playhead = document.createElement("div");
    playhead.setAttribute("class", "playhead");
    const playheadScrubber = document.createElement("div");
    playheadScrubber.setAttribute("class", "playhead-scrubber");
    const controls = document.createElement("div");
    controls.setAttribute("class", "controls");
    const playButton = document.createElement("button");
    playButton.setAttribute("class", "play-toggle control-button paused");
    playButton.setAttribute("disabled", "disabled");

    const loadingSpinner = document.createElement("div");
    loadingSpinner.setAttribute("class", "lds-ring");
    loadingSpinner.style.top = `calc(${canvas.height * 0.5}px - 10px)`;
    for (let i = 0; i < 4; i++) {
      const item = document.createElement("div");
      loadingSpinner.append(item);
    }

    playButton.innerHTML = `
      <svg class="play-icon" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 384 512"><path fill="currentColor" d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>
      <svg class="pause-icon" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 320 512"><path fill="currentColor" d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"/></svg>
    `;
    mainPlayheadScrubber.append(mainPlayheadScrubberVisible);
    mainPlayhead.append(mainPlayheadScrubber);
    handleLeftInner.append(handleLeftVisible);
    handleRightInner.append(handleRightVisible);
    handleLeft.append(handleLeftInner);
    handleRight.append(handleRightInner);
    handle.append(handleLeft, handleRight);
    playhead.append(playheadScrubber);
    miniMap.append(mapCanvas, playheadCanvas, leftOfHandle, handle, rightOfHandle, playhead);
    controls.append(playButton);
    container.append(mainPlayhead, canvas, mainPlayheadCanvas, miniMap, controls, loadingSpinner);

    const audio = document.createElement("audio");
    const styles = document.createElement("style");
    styles.textContent = `
      * {
        box-sizing: border-box;
      }     
      .container {
          margin: 0 22px;              
          display: flex;
          position: relative;
          flex-direction: column;
          padding-top: 44px;            
      }
      .canvas {
          margin: 0;
          padding: 0;
          touch-action: none;
          user-select: none;
          cursor: grab;
      }
      .main-playhead-canvas {
          margin: 0;
          padding: 0;
          position: absolute;
          touch-action: none;
          user-select: none;
          pointer-events: none;
      }
      .map-canvas {               
          margin: 0;
      }
      .playhead-canvas {
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
      .mini-map {         
          height: 60px;
          position: relative;
          margin: 0;
      }
      .handle {
          background: rgba(130, 0, 130, 0);
          height: 100%;
          top: 0;
          left: 0;
          right: 0;
          /*touch-action: none;*/
          /*user-select: none;*/
          position: absolute;
          cursor: grab;
          border: 1px solid rgba(255, 255, 255, 0.75);                       
      }
      .grabbing {
        cursor: grabbing;
      }
      .handle:hover {
          border: 2px solid rgba(255, 255, 255, 0.75);
      }
      .left-of-handle {
          background: rgba(0, 0, 0, 0.25);
          height: 100%;
          top: 0;
          left: 0;
          touch-action: none;
          user-select: none;
          position: absolute;
      }
      .right-of-handle {
          background: rgba(0, 0, 0, 0.25);
          height: 100%;
          top: 0;
          right: 0;
          touch-action: none;
          user-select: none;
          position: absolute;
      }
      .handle-left {
          width: 0;
          position: absolute;
          left: 0;         
          height: 100%;
          cursor: col-resize;
      }     
      .handle-right {
          width: 0;
          position: absolute;
          right: 0;         
          height: 100%;
          cursor: col-resize;
      }
      
      .inner-handle-left, .inner-handle-right {
          width: 44px;
          position: relative;
          left: -22px;
          height: 100%;         
          z-index: 1;
      }
      .inner-handle-left > div, .inner-handle-right > div {
        position: absolute;       
        width: 10px;
        height: 100%;
        background: rgba(255, 255, 255, 0.75);
        pointer-events: none;
        user-select: none;
        touch-action: none;
      }
      .handle:not(:hover) .inner-handle-left > div, .handle:not(:hover) .inner-handle-right > div {
        height: calc(100% + 2px);
        top: -1px;
      }
      .handle:hover .inner-handle-left > div, .handle:hover .inner-handle-right > div {
        height: calc(100% + 4px);
        top: -2px;
      }
      .inner-handle-left:hover > div , .inner-handle-right:hover > div {
        background: white;
      }
      .inner-handle-left > div {
        border-top-left-radius: 5px;
        border-bottom-left-radius: 5px;
        left: calc(50% - 10px);
      }
      .inner-handle-right > div {
        border-top-right-radius: 5px;
        border-bottom-right-radius: 5px;
        left: 50%;
      }
      
      .controls {
          padding: 10px;
          display: flex;         
          /*justify-content: center;*/
          background: lightslategray;
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
      .playhead {
          /* Maybe can just do this with the playhead line too, just needs to be px */         
          height: 44px;
          width: 0;
          top: 60px;
          z-index: 100;
          touch-action: none;
          user-select: none;
          position: absolute;
      }
      .playhead-scrubber {
          background: orange;
          height: 44px;
          width: 44px;
          position: relative;
          left: -22px;
          display: none;
      }
      .main-playhead {                  
          height: 44px;
          width: 0;
          top: 0;
          z-index: 100;
          touch-action: none;
          user-select: none;
          position: absolute;
          cursor: grab;
          display: none;
      }
      .main-playhead-scrubber {         
          height: 44px;
          width: 44px;
          position: relative;
          left: -22px;                 
      }
      .main-playhead-scrubber > div {
          position: absolute;                
          bottom: 0;
          background: rgba(255, 255, 255, 0.75);
          pointer-events: none;
          user-select: none;
          touch-action: none;
          left: calc(50% - 5px);         
          width: 0; 
          height: 0;
          background: transparent; 
          border-left: 5px solid transparent;
          border-right: 5px solid transparent; 
          border-top: 20px solid white;
         
      }
         
      .lds-ring {
        display: inline-block;
        position: absolute;
        left: calc(50% - 40px);      
        width: 80px;
        height: 80px;             
      }
      .lds-ring div {
        box-sizing: border-box;
        display: block;
        position: absolute;
        width: 64px;
        height: 64px;
        margin: 8px;
        border: 8px solid #fff;
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
      
    `;

    this.shadowRoot.append(styles, container, audio);

    const timelineElements = {
      handle,
      handleLeftInner,
      handleRightInner,
      leftOfHandle,
      rightOfHandle,
      mapCanvas,
      canvas,
    };

    const playerElements = {
      playheadCanvas,
      playheadScrubber,
      mainPlayheadScrubber,
      mainPlayheadCanvas,
      audio,
      playButton,
      canvas,
      playheadCanvasCtx: playheadCanvas.getContext("2d"),
      mainPlayheadCanvasCtx: mainPlayheadCanvas.getContext("2d"),
    };
    const resizeCanvas = (canvas) => {
      const bounds = canvas.parentElement.getBoundingClientRect();
      canvas.style.height = `${canvas.height}px`;
      canvas.height = canvas.height * devicePixelRatio;
      canvas.width = bounds.width * devicePixelRatio;
      canvas.style.width = `${bounds.width}px`;
    };


    const mapCtx = mapCanvas.getContext("2d");
    const ctx = canvas.getContext("2d");

    (async () => {
      let raf;
      const render = ({ detail: { initialRender, force }}) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const startZeroOne = timelineState.left;
          const endZeroOne = timelineState.right;
          positionHandles(startZeroOne, endZeroOne);
          if (!audioState.playing) {
            audioState.progressSampleTime = performance.now();
            updatePlayhead(audioState, timelineState, sharedState, playerElements);
          }
          //audioState.progressSampleTime = performance.now();
          // console.log("render range", startZeroOne, endZeroOne);
          renderToContext(ctx, startZeroOne, endZeroOne).then(() => {
            //console.trace("render context", timelineState.left, timelineState.right);
          });
          if (initialRender) {
            renderToContext(mapCtx, 0, 1);
          }
          renderRange(startZeroOne, endZeroOne, canvas.width, force).then(() => {
            renderToContext(ctx, timelineState.left, timelineState.right).then(() => {
              //console.log("render context", timelineState.left, timelineState.right);
            });
            if (initialRender) {
              console.log("should rerender minimap");
              renderToContext(mapCtx, 0, 1).then(() => {
                console.log("rerender minimap");
                if (loadingSpinner.parentElement) {
                  container.removeChild(loadingSpinner);
                  playButton.removeAttribute("disabled");
                  this.shadowRoot.dispatchEvent(new Event("loaded", {composed: true, bubbles: false, cancelable: false}));
                }
              });
            }
          });

          //const renderState = await renderToContext(ctx, startZeroOne, endZeroOne);
          // state.prevLeft = startZeroOne;
          // state.prevRight = endZeroOne;
          //renderState.pendingRender.complete = true;
        });
      };

      const sharedState = { interacting: false };

      const { renderRange, renderToContext, audioFileUrl, numAudioSamples, invalidateCanvasCaches } = await initSpectrogram(src);
      const { positionHandles, timelineState } = initTimeline(sharedState, timelineElements, numAudioSamples);
      const { audioState, updatePlayhead } = initAudioPlayer(sharedState, timelineState, playerElements);
      await initAudio(playerElements, audioFileUrl, audioState);

      canvas.addEventListener("interaction-begin", () => {
        //console.log("interaction begin");
        sharedState.interacting = true;
      });
      canvas.addEventListener("interaction-end", () => {
        sharedState.interacting = false;
        //console.log("interaction end", timelineState.left, timelineState.right);
        render({detail: {initialRender: false, force: true }});
      });
      canvas.addEventListener("range-change", render);
      canvas.dispatchEvent(new CustomEvent("range-change", {
        detail: {
          startZeroOne: 0,
          endZeroOne: 1,
          initialRender: true
        }
      }));
      const resizeCanvases = (e) => {
        resizeCanvas(timelineElements.canvas);
        resizeCanvas(playerElements.mainPlayheadCanvas);
        resizeCanvas(timelineElements.mapCanvas);
        resizeCanvas(playerElements.playheadCanvas);
        if (e) {
          {
            const startZeroOne = timelineState.left;
            const endZeroOne = timelineState.right;
            positionHandles(startZeroOne, endZeroOne);
            if (!audioState.playing) {
              audioState.progressSampleTime = performance.now();
              updatePlayhead(audioState, timelineState, sharedState, playerElements);
            }
            //audioState.progressSampleTime = performance.now();
            // console.log("render range", startZeroOne, endZeroOne);
            renderToContext(ctx, startZeroOne, endZeroOne).then(() => {
              //console.trace("render context", timelineState.left, timelineState.right);
            });
          }

          timelineElements.canvas.dispatchEvent(new Event("interaction-begin"));
          clearTimeout(sharedState.interactionTimeout);
          sharedState.interactionTimeout = setTimeout(() => {
            invalidateCanvasCaches();
            renderRange(0, 1, canvas.width, true).then(() => {
              render({detail: {initialRender: true, force: true }});
            });
            sharedState.interacting = false;
            //timelineElements.canvas.dispatchEvent(new Event("interaction-end"));
          }, 300);
        }
      };

      window.addEventListener("resize", resizeCanvases);
      resizeCanvases();
    })();
  }
}
customElements.define("spectastiq-viewer", Spectastiq);
