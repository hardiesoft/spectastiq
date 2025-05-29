import {initTimeline} from "./timeline-wrapper.js";
import {colorMaps, initSpectrogram} from "./spectrogram-renderer.js";
import {initAudio, initAudioPlayer} from "./audio-player.js";
import {mapRange} from "./webgl-drawimage.js";
import {COLOR_MAPS} from "./colormaps.js";

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
  #spectrogram-container.custom-interaction-mode {
    cursor: unset;
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
  #container:not(.audio-loaded) #mini-map, #container:not(.audio-loaded) #canvas-container {
    pointer-events: none;    
  }
  #container:not(.audio-loaded) #spectrogram-container {
    cursor: default;
  }
  .select-user-file, .select-user-file input, .error-message-container {
    display: none;
  }
  #container.no-src .select-user-file, #container.error .error-message-container {   
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;  
  }
  .error-message {
    background: darkred;
    color: white;
    font-family: sans-serif;
    padding: 5px 5px 5px 7px;
    border-radius: 3px;
    font-size: 14px;
    box-shadow: #111 0 2px 3px;
  }
  .error-message pre {
    background: rgba(0, 0, 0, 0.5);
    display: inline-block;
    color: #ddd;
    padding: 3px;
    margin: 0;
    font-size: 13px;
    border-radius: 3px;
  }
  #controls {   
    display: flex;                   
    background: #333;
  }
  #controls.disabled {
    pointer-events: none;
  }
  #default-controls {
    position: relative;
    display: flex;
    width: 100%;
    justify-content: space-between;
  }
  .control-button {
    all: unset;
    width: 44px;
    height: 44px;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    background: transparent;
    border-radius: 3px;
    color: #ccc;   
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
  
  .left-controls {
    display: flex;   
    font-family: sans-serif;
    color: #ccc;
    align-items: center;
  }
  .right-controls {
    display: flex;
  }
  .time-elapsed {
    display: inline-flex;
    line-height: 0;
    font-size: 14px;
  }
  
  .additional-controls {
    position: absolute;
    right: 5px;
    bottom: 45px;
    box-shadow: rgba(0, 0, 0, 0.5) 0 2px 3px;
    z-index: 1;   
    background: #333;
    color: #ccc;
    font-family: Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.2rem;
    max-width: 192px;
    padding-bottom: 8px;
    display: none;
  }
  .additional-controls.show {
      display: block;
  }
  
  .additional-controls .btn {
    display: flex;
    height: 44px;
    line-height: 44px;
    padding: 0 10px;
    justify-content: space-between;
    align-items: center;
  }
  
  .additional-controls .palettes {
    display: flex;
    flex-direction: column;
  }
  .additional-controls .palettes > .svg-tick {
    display: none;
  }
  .additional-controls .palettes canvas {
    border-radius: 2px;
    margin: 0 8px;
    width: 16px;
    height: 16px;
  }
  .fullscreen-toggle {
    display: none;
  }
  .fullscreen-toggle.allow-fullscreen {
    display: inline-flex;
    align-items: center;
    justify-content: center;  
  }
  
  /* Palette controls (radiogroup) */
  .radio-custom {
    opacity: 0;
    position: absolute;   
  }
  
  .radio-custom, .radio-custom-label {
    display: inline-block;
    vertical-align: middle;
    margin: 5px;
    cursor: pointer;
  }
  
  .radio-custom-label {
    line-height: 100%;
    padding-left: 8px;
    display: flex;
    align-content: center;
    position: relative;
    text-transform: uppercase;
    align-items: center;
    font-size: 12px;
  }
  .radio-custom-label > .svg-tick {
    margin-left: 5px;
  }
  .radio-custom:not(:checked) + .radio-custom-label > .svg-tick {
    opacity: 0;
  }
  
  .radio-custom:checked + .radio-custom-label > .svg-tick {  
    opacity: 1;
  }
  
  /* Toggle style checkboxes */
  .additional-controls input[type=checkbox]{
    height: 0;
    width: 0;
    visibility: hidden;
  }

  .additional-controls input[type=checkbox] + label {
    cursor: pointer;
    text-indent: -9999px;
    width: 32px;
    height: 16px;
    background: #666;
    display: block;
    border-radius: 16px;
    position: relative;
  }

  .additional-controls input[type=checkbox] + label:after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    background: #333;
    border-radius: 12px;
    transition: 0.3s;
  }

  .additional-controls input[type=checkbox]:checked + label {
    background: #ccc;
  }

  .additional-controls input[type=checkbox]:checked + label:after {
    left: calc(100% - 2px);
    transform: translateX(-100%);
  }

  .additional-controls input[type=checkbox] + label:active:after {
    width: 20px;
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
    <div class="select-user-file">
      <button class="select-user-file-btn">Open local audio file</button>
      <input type="file" accept="audio/*" class="select-user-file-input" />
    </div>
    <div class="error-message-container">
      <span class="error-message"></span>
    </div>
  </div>
  <div id="controls">
    <slot name="player-controls">
      <div id="default-controls">
        <div class="left-controls">
          <button class="play-toggle control-button paused" disabled id="play-button">
            <svg class="play-icon" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 384 512"><path fill="currentColor" d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>
            <svg class="pause-icon" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 320 512"><path fill="currentColor" d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"/></svg>
          </button>
          <span class="time-elapsed"></span>
        </div>
        <div class="right-controls">            
          <div class="show-additional-controls control-button">
            <svg width="19.04" xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 19.04 20" fill="currentColor">
              <path d="M8.345,20C7.895,20,7.507,19.85,7.182,19.55C6.857,19.250,6.662,18.883,6.595,18.45L6.370,16.8C6.153,16.717,5.949,16.617,5.757,16.5C5.566,16.383,5.378,16.258,5.195,16.125L3.645,16.775C3.228,16.958,2.812,16.975,2.395,16.825C1.978,16.675,1.653,16.408,1.420,16.025L0.245,13.975C0.012,13.592,-0.055,13.183,0.045,12.750C0.145,12.317,0.370,11.958,0.720,11.675L2.045,10.675C2.028,10.558,2.020,10.446,2.020,10.338L2.020,9.662C2.020,9.554,2.028,9.442,2.045,9.325L0.720,8.325C0.370,8.042,0.145,7.683,0.045,7.250C-0.055,6.817,0.012,6.408,0.245,6.025L1.420,3.975C1.653,3.592,1.978,3.325,2.395,3.175C2.812,3.025,3.228,3.042,3.645,3.225L5.195,3.875C5.378,3.742,5.570,3.617,5.770,3.5C5.970,3.383,6.170,3.283,6.370,3.200L6.595,1.550C6.662,1.117,6.857,0.75,7.182,0.45C7.507,0.150,7.895,0,8.345,0L10.695,0C11.145,0,11.533,0.15,11.857,0.45C12.182,0.75,12.378,1.117,12.445,1.55L12.670,3.2C12.887,3.283,13.091,3.383,13.283,3.5C13.474,3.617,13.662,3.742,13.845,3.875L15.395,3.225C15.812,3.042,16.228,3.025,16.645,3.175C17.062,3.325,17.387,3.592,17.62,3.975L18.795,6.025C19.028,6.408,19.095,6.817,18.995,7.250C18.895,7.683,18.670,8.042,18.320,8.325L16.995,9.325C17.012,9.442,17.02,9.554,17.02,9.662L17.020,10.338C17.020,10.446,17.003,10.558,16.97,10.675L18.295,11.675C18.645,11.958,18.87,12.317,18.970,12.75C19.07,13.183,19.003,13.592,18.77,13.975L17.57,16.025C17.337,16.408,17.012,16.675,16.595,16.825C16.178,16.975,15.762,16.958,15.345,16.775L13.845,16.125C13.662,16.258,13.47,16.383,13.27,16.5C13.07,16.617,12.87,16.717,12.67,16.8L12.445,18.45C12.378,18.883,12.182,19.250,11.857,19.55C11.533,19.850,11.145,20,10.695,20L8.345,20ZL8.345,20ZM8.520,18L10.495,18L10.845,15.35C11.362,15.217,11.841,15.021,12.283,14.763C12.724,14.504,13.128,14.192,13.495,13.825L15.97,14.850L16.945,13.15L14.795,11.525C14.878,11.292,14.937,11.046,14.97,10.787C15.003,10.529,15.02,10.267,15.02,10C15.020,9.733,15.003,9.471,14.97,9.213C14.937,8.954,14.878,8.708,14.795,8.475L16.945,6.850L15.97,5.15L13.495,6.2C13.128,5.817,12.724,5.496,12.283,5.237C11.841,4.979,11.362,4.783,10.845,4.65L10.52,2L8.545,2L8.195,4.65C7.678,4.783,7.199,4.979,6.757,5.237C6.316,5.496,5.912,5.808,5.545,6.175L3.07,5.15L2.095,6.85L4.245,8.45C4.162,8.7,4.103,8.95,4.07,9.2C4.037,9.45,4.02,9.717,4.02,10C4.02,10.267,4.037,10.525,4.07,10.775C4.103,11.025,4.162,11.275,4.245,11.525L2.095,13.15L3.07,14.85L5.545,13.8C5.912,14.183,6.316,14.504,6.757,14.763C7.199,15.021,7.678,15.217,8.195,15.35L8.52,18ZL8.52,18ZM9.570,13.5C10.537,13.5,11.362,13.158,12.045,12.475C12.728,11.792,13.07,10.967,13.07,10C13.07,9.033,12.728,8.208,12.045,7.525C11.362,6.842,10.537,6.5,9.57,6.5C8.587,6.5,7.757,6.842,7.083,7.525C6.408,8.208,6.07,9.033,6.07,10C6.07,10.967,6.408,11.792,7.083,12.475C7.757,13.158,8.587,13.5,9.57,13.5ZL9.570,13.5Z" />
            </svg>
          </div>                 
          <div class="additional-controls">
            <div class="btn">
              <span>Frequency scale</span>
              <input type="checkbox" id="freq-switch" /><label for="freq-switch">Toggle</label>
            </div>
            <div class="btn">
              <span>Time scale</span>
              <input type="checkbox" id="time-switch" /><label for="time-switch">Toggle</label>
            </div>
            <div class="btn">
              <span>Palette</span>
            </div>
            <div class="palettes">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" class="svg-tick" fill="currentColor">                           
                <path d="M9.550,15.150L18.025,6.675C18.225,6.475,18.458,6.375,18.725,6.375C18.992,6.375,19.225,6.475,19.425,6.675C19.625,6.875,19.725,7.113,19.725,7.388C19.725,7.663,19.625,7.900,19.425,8.100L10.250,17.300C10.050,17.500,9.817,17.600,9.550,17.600C9.283,17.600,9.050,17.500,8.850,17.300L4.550,13.000C4.350,12.800,4.254,12.563,4.263,12.288C4.271,12.013,4.375,11.775,4.575,11.575C4.775,11.375,5.013,11.275,5.288,11.275C5.563,11.275,5.800,11.375,6.000,11.575L9.550,15.150Z"></path>                                        
              </svg>
            </div>                  
          </div>
          <button class="fullscreen-toggle control-button">
            <svg width="20" height="22.1" viewBox="0 0 24 22.1" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
              <path d="M6.6 2.6h-4v3H0V0h6.6v2.6ZM17.4 0H24v5.6h-2.6v-3h-4V0Zm0 19.5h4v-3H24V22h-6.6v-2.6ZM6.6 22.1H0v-5.6h2.6v3h4v2.6Z" />
            </svg>
          </button>   
        </div>
      </div>
    </slot>
  </div>
</div>
`;

export default class Spectastiq extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: "open"});
  }

  inited = false;
  sharedState = {interacting: false};

  static observedAttributes = [
    "src",
    "height",
    "time-scale",
    "frequency-scale",
    "color-scheme",
    "colour-scheme",
  ];

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
          if (
            !colorMaps
              .map((p) => p.toLowerCase())
              .includes(newValue.toLowerCase())
          ) {
            console.error(
              `Unknown color scheme: ${newValue}. Allowed schemes are any of '${colorMaps.join(
                "', '"
              )}'`
            );
            return;
          }
          while (
            this.nextPalette().toLowerCase() !==
            this.colorScheme.toLowerCase()
            ) {
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
    this.pause()
    this.unload();
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

  get allowFullscreen() {
    if (this.hasAttribute("allow-fullscreen")) {
      const fullscreen = this.getAttribute("allow-fullscreen");
      return fullscreen !== "false" && fullscreen !== "0" && fullscreen !== null;
    }
    return false;
  }

  set allowFullscreen(newValue) {
    this.setAttribute("allow-fullscreen", newValue);
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
    return (
      this.getAttribute("color-scheme") || this.getAttribute("colour-scheme") || Object.keys(COLOR_MAPS)[0]
    );
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
  }

  loadSrc(src) {
    const startTimeOffset = Number(this.getAttribute("start")) || 0;
    const endTimeOffset = Number(this.getAttribute("end")) || 1;
    const delegateDoubleClick = this.getAttribute("delegate-double-click");
    this.applicationHandlesDoubleClick = delegateDoubleClick !== "false" && delegateDoubleClick !== "0" && delegateDoubleClick !== null;
    const requestHeaders = this.getAttribute("request-headers");
    let headers = {};
    if (requestHeaders) {
      try {
        headers = JSON.parse(requestHeaders);
      } catch (e) {
        console.error(`Malformed JSON passed for request headers: ${e}`);
      }
    }
    const {drawTimelineUI, timelineState, setInitialZoom} = this.timeline;
    const {audioState, updatePlayhead} = this.audioPlayer;
    const canvas = this.timelineElements.canvas;
    const mapCtx = this.timelineElements.mapCanvas.getContext("webgl2");
    const ctx = canvas.getContext("webgl2");
    const timescaleOverlayContext =
      this.timelineElements.timescaleCanvas.getContext("2d");
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
        this.pause();
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
        this.abortController.signal.addEventListener("onabort", () => {
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
          if (!downloadAudioResponse.ok) {
            this.showErrorMessage(`Audio file not found <pre>${src}</pre>`);
          } else {
            if (!this.inited) {
              // Put this after the fetch otherwise we can never catch it fast enough.
              // FIXME: Even so, this doesn't fire in chrome for listeners in time.
              this.shadowRoot.dispatchEvent(
                new Event("ready", {
                  composed: true,
                  bubbles: false,
                  cancelable: false,
                })
              );
              this.inited = true;
            }
            const reader = downloadAudioResponse.body.getReader();
            let expectedLength = parseInt(
              downloadAudioResponse.headers.get("Content-Length"),
              10
            );
            if (isNaN(expectedLength)) {
              expectedLength = parseInt(
                downloadAudioResponse.headers.get("Fallback-Content-Length"),
                10
              );
            }
            if (!isNaN(expectedLength)) {
              if (!this.progressBar.parentElement) {
                this.timelineElements.spectrogramContainer.appendChild(
                  this.progressBar
                );
              }
            }
            while (!this.requestAborted) {
              const {done, value} = await reader.read();
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
            const spectrogramInited = await initSpectrogram(
              fileBytes,
              this.persistentSpectrogramState || null
            );
            if (spectrogramInited.error) {
              this.showErrorMessage(`${spectrogramInited.error} for <pre>${this.localSrc || src}</pre>`);
            } else {
              const {
                renderRange,
                renderToContext,
                audioFloatData,
                invalidateCanvasCaches,
                terminateWorkers,
                cyclePalette,
                getGainForRegion,
                persistentSpectrogramState,
              } = spectrogramInited;
              this.getGainForRegionOfInterest = getGainForRegion;
              timelineState.numAudioSamples = audioFloatData.length;
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
              audioState.audioProgressZeroOne = 0;
              audioState.playbackStartOffset = 0;
              audioState.audioProgressSampleTime = performance.now();
              audioState.wasPlaying = false;
              audioState.playheadStartOffsetXZeroOne = 0;
              audioState.playheadDragOffsetX = 0;
              audioState.mainPlayheadStartOffsetXZeroOne = 0
              audioState.mainPlayheadDragOffsetX = 0;
              audioState.dragPlayheadRaf = 0;
              audioState.playheadWasInRangeWhenPlaybackStarted = false;

              this.persistentSpectrogramState = persistentSpectrogramState;
              this.terminateWorkers = terminateWorkers;
              this.invalidateCanvasCaches = invalidateCanvasCaches;
              this.renderRange = renderRange;

              const defaultPalette = "Viridis";
              // Select starting palette
              let palette = this.colorScheme || defaultPalette;
              if (
                !colorMaps
                  .map((p) => p.toLowerCase())
                  .includes(palette.toLowerCase())
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
                  timelineState.isDarkTheme = nextPalette !== "Grey";
                  const startZeroOne = timelineState.left;
                  const endZeroOne = timelineState.right;
                  const top = timelineState.top;
                  const bottom = timelineState.bottom;
                  drawTimelineUI(
                    startZeroOne,
                    endZeroOne,
                    timelineState.currentAction
                  );
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
                // FIXME: In the shader, we need to do this also so that the texture stretches correctly.
                const maxTextureHeight = Math.max(canvas.height, TEXTURE_HEIGHT);
                const maxZoom = (maxTextureHeight / (canvas.height / window.devicePixelRatio));
                const maxYZoom = maxZoom * MAX_ZOOMED_REGION;
                // const maxYZoom =
                //   (TEXTURE_HEIGHT / (canvas.height / window.devicePixelRatio)) *
                //   MAX_ZOOMED_REGION;
                const rangeY = top - bottom;
                const minRangeY = 1 / maxZoom;

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

                const maxTextureHeight = Math.max(canvas.height, TEXTURE_HEIGHT);
                const maxZoom = (maxTextureHeight / (canvas.height / window.devicePixelRatio));
                const maxYZoom = maxZoom * MAX_ZOOMED_REGION;
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
              const clampZeroMax = (x, max) => Math.max(0, Math.min(max, x));
              const redrawTimescaleOverlay = (
                ctx,
                startZeroOne,
                endZeroOne,
                duration
              ) => {
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
                const twentyPx = tenPx * 2;
                const fortyPx = tenPx * 4;
                ctx.font = `${tenPx}px sans-serif`;
                ctx.textAlign = "center";
                let xOpacity = 0.5;
                const n1 = mapRange(0 / duration, startZeroOne, endZeroOne, 0, 1) *
                  ctx.canvas.width / devicePixelRatio;
                const n2 = mapRange(1 / duration, startZeroOne, endZeroOne, 0, 1) *
                  ctx.canvas.width / devicePixelRatio;
                const distanceBetweenSecondNotches = n2 - n1;
                const maxOpacity = 0.5;
                const breakPointsPx = [2, 4, 8, 16, 32, 64, 128, 256];
                // Work out the zoom levels these correspond to:
                for (let i = startSeconds; i < endSeconds; i += 1) {
                  const m0 = (i) % 64 === 0;
                  const m1 = (i) % 32 === 0;
                  const m2 = (i) % 16 === 0;
                  const m3 = (i) % 8 === 0;
                  const m4 = (i) % 4 === 0;
                  const m5 = (i) % 2 === 0;
                  let displayNotch = false;
                  let initialXOpacity = 0;
                  if (distanceBetweenSecondNotches < breakPointsPx[0]) { // display a notch every 16 px
                    displayNotch = m0;
                  } else if (distanceBetweenSecondNotches < breakPointsPx[1]) {
                    displayNotch = m0 || m1;
                  } else if (distanceBetweenSecondNotches < breakPointsPx[2]) {
                    displayNotch = m0 || m1 || m2;
                  } else if (distanceBetweenSecondNotches < breakPointsPx[3]) {
                    displayNotch = m0 || m1 || m2 || m3;
                  } else if (distanceBetweenSecondNotches < breakPointsPx[4]) {
                    displayNotch = m0 || m1 || m2 || m3 || m4;
                  } else if (distanceBetweenSecondNotches < breakPointsPx[5]) {
                    displayNotch = m0 || m1 || m2 || m3 || m4 || m5;
                  } else {
                    displayNotch = true;
                  }
                  if (displayNotch) {
                    if (m0) {
                      initialXOpacity = maxOpacity;
                    } else if (m1) {
                      initialXOpacity = clampZeroMax(mapRange(distanceBetweenSecondNotches, breakPointsPx[0], breakPointsPx[1], 0, maxOpacity), maxOpacity);
                    } else if (m2) {
                      initialXOpacity = clampZeroMax(mapRange(distanceBetweenSecondNotches, breakPointsPx[1], breakPointsPx[2], 0, maxOpacity), maxOpacity);
                    } else if (m3) {
                      initialXOpacity = clampZeroMax(mapRange(distanceBetweenSecondNotches, breakPointsPx[2], breakPointsPx[3], 0, maxOpacity), maxOpacity);
                    } else if (m4) {
                      initialXOpacity = clampZeroMax(mapRange(distanceBetweenSecondNotches, breakPointsPx[3], breakPointsPx[4], 0, maxOpacity), maxOpacity);
                    } else if (m5) {
                      initialXOpacity = clampZeroMax(mapRange(distanceBetweenSecondNotches, breakPointsPx[4], breakPointsPx[5], 0, maxOpacity), maxOpacity);
                    } else {
                      initialXOpacity = clampZeroMax(mapRange(distanceBetweenSecondNotches, breakPointsPx[5], breakPointsPx[6], 0, maxOpacity), maxOpacity);
                    }
                  }
                  // Work out whether we want to draw this notch or not at this zoom level.
                  if (i !== 0 && displayNotch) {
                    const oX =
                      mapRange(i / duration, startZeroOne, endZeroOne, 0, 1) *
                      ctx.canvas.width;
                    xOpacity = initialXOpacity;
                    if (this.drawFrequencyScale && oX > canvas.width - fortyPx) {
                      xOpacity = clampZeroOne(mapRange(oX, canvas.width - fortyPx, canvas.width - twentyPx, 1, 0)) * initialXOpacity;
                    }
                    ctx.fillStyle = `rgba(255, 255, 255, ${xOpacity})`;
                    // Draw notches
                    ctx.fillRect(oX, 0, 1, ctx.canvas.height / 2);
                    ctx.fillStyle = `rgba(255, 255, 255, ${xOpacity})`;
                    ctx.fillText(this.formatTime(i), oX, ctx.canvas.height / 2 + tenPx);

                  }
                  // Drawing inter-second notches
                  const opacity = clampZeroOne(
                    mapRange(distanceBetweenSecondNotches, breakPointsPx[6], breakPointsPx[7], 0, 1)
                  );
                  if (opacity > 0) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${opacity * xOpacity})`;
                    for (let j = 1; j < 10; j += 1) {
                      const oX =
                        mapRange(
                          (i + 0.1 * j) / duration,
                          startZeroOne,
                          endZeroOne,
                          0,
                          1
                        ) * ctx.canvas.width;
                      let h = ctx.canvas.height / 3;
                      if (j === 5) {
                        h += 5 * devicePixelRatio;
                      }
                      ctx.fillRect(oX, 0, 1, h);
                    }
                  }
                }
                ctx.restore();
              };
              this.redrawTimescaleOverlay = () =>
                redrawTimescaleOverlay(
                  timescaleOverlayContext,
                  timelineState.left,
                  timelineState.right,
                  audioState.audioDuration
                );
              this.clearTimescaleOverlay = () => {
                timescaleOverlayContext.save();
                timescaleOverlayContext.clearRect(
                  0,
                  0,
                  ctx.canvas.width,
                  ctx.canvas.height
                );
              };

              this.render = ({detail: {initialRender, force}}) => {
                if (this.raf) {
                  cancelAnimationFrame(this.raf);
                  this.raf = undefined;
                }
                this.raf = requestAnimationFrame(() => {
                  const startZeroOne = timelineState.left;
                  const endZeroOne = timelineState.right;
                  const top = timelineState.top;
                  const bottom = timelineState.bottom;
                  if (
                    (this.deferredWidth &&
                      ctx.canvas.width !== this.deferredWidth) ||
                    (this.deferredHeight &&
                      ctx.canvas.height !== this.deferredHeight)
                  ) {
                    this.resizeCanvases(this.deferredWidth, true);
                    this.timelineElements.container.classList.remove("disabled");
                  } else if (
                    this.deferredWidth &&
                    ctx.canvas.width === this.deferredWidth &&
                    this.deferredHeight &&
                    ctx.canvas.height === this.deferredHeight
                  ) {
                    this.timelineElements.container.classList.remove("disabled");
                  }

                  drawTimelineUI(
                    startZeroOne,
                    endZeroOne,
                    timelineState.currentAction
                  );
                  if (!audioState.playing) {
                    audioState.progressSampleTime = performance.now();
                    updatePlayhead();
                  }

                  // TODO: Move somewhere sensible
                  this.drawTimescale = this.timeScale;
                  this.drawFrequencyScale = this.frequencyScale;
                  if (this.drawTimescale) {
                    redrawTimescaleOverlay(
                      timescaleOverlayContext,
                      startZeroOne,
                      endZeroOne,
                      audioState.audioDuration
                    );
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
                                    duration: audioState.audioDuration,
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
              initAudio(
                this.playerElements,
                audioFloatData,
                audioState
              );
              this.removePlaybackFrequencyBandPass();
              if (audioState.playing || audioState.audioProgressZeroOne !== 0) {
                this.pause();
              }
              // Initial render
              this.render({detail: {initialRender: true, force: true}});
              // TODO: Animate to region of interest could be replaced by reactive setting of :start :end props?
              this.resizeInited = true;
            }
          }
        } catch (e) {
          // Failed to load audio, should show an error
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

  showErrorMessage(error) {
    if (
      this.loadingSpinner &&
      this.loadingSpinner.parentElement
    ) {
      this.loadingSpinner.parentElement.removeChild(
        this.loadingSpinner
      );
    }
    this.timelineElements.container.classList.add("error");
    this.timelineElements.container.querySelector(".error-message").innerHTML = `Error: ${error}`;
    this.endLoad();
  }

  init() {
    // TODO: Maybe pass in min/max frequency bounds, so that the view is restricted to AOI?
    // TODO: Get height dynamically from attributes, and respond to changes in height.
    const lazyLoad = this.hasAttribute("lazy");
    const allowFullscreen = this.hasAttribute("allow-fullscreen");
    const totalHeight = this.height || 360;
    this.timelineHeight = Math.min(60, Math.max(44, totalHeight - 200));
    this.spectrogramHeight = totalHeight - this.timelineHeight;

    const src = this.getAttribute("src");
    const root = this.shadowRoot;
    if (!this.inited) {
      root.appendChild(template.content.cloneNode(true));
    }

    const container = root.getElementById("container");
    const spectrogramContainer = root.getElementById("spectrogram-container");
    const canvasContainer = root.getElementById("canvas-container");
    const miniMapContainer = root.getElementById("mini-map");
    const mapCanvas = root.getElementById("map-canvas");
    const canvas = root.getElementById("spectrogram-canvas");
    const overlayCanvas = root.getElementById("spectastiq-overlay-canvas");
    const timescaleCanvas = root.getElementById(
      "spectastiq-timescale-overlay-canvas"
    );
    const userOverlayCanvas = root.getElementById("user-overlay-canvas");
    const playheadCanvas = root.getElementById("playhead-canvas");
    const timelineUICanvas = root.getElementById("timeline-ui-canvas");

    this.formatTime = (time) => {
      let seconds = Math.floor(time);
      if (seconds < 60) {
        return `0:${`${seconds}`.padStart(2, "0")}`;
      }
      const minutes = Math.floor(seconds / 60);
      seconds = seconds - minutes * 60;
      return `${minutes}:${seconds.toString().padStart(2, "0").padEnd(2, "0")}`;
    };

    const setupDefaultControls = () => {
      const additionalControls = root.querySelector(".additional-controls");
      const showAdditionalControlsBtn = root.querySelector(".show-additional-controls");
      const timeElapsed = root.querySelector(".time-elapsed");
      const fullscreenToggleBtn = root.querySelector(".fullscreen-toggle");
      if (allowFullscreen) {
        fullscreenToggleBtn.classList.add("allow-fullscreen");
        const initialHeight = this.height;
        const spectastiq = this;
        const uiHeight = 44;
        const exitFullscreen = () => {
          if (!document.fullscreenElement) {
            spectastiq.height = initialHeight;
            window.removeEventListener("fullscreenchange", exitFullscreen);
          }
        };
        fullscreenToggleBtn.addEventListener("click", () => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
              console.log(`Error attempting to enable fullscreen: ${err.message}`);
            }).then(() => {
              window.addEventListener("fullscreenchange", exitFullscreen);
              spectastiq.height = window.screen.height - uiHeight;
            });
          } else {

            document.exitFullscreen().then(exitFullscreen);
          }
        });
      }
      root.addEventListener("playhead-update", e => {
        timeElapsed.textContent = `${this.formatTime(e.detail.timeInSeconds)} / ${this.formatTime(this.timeline.timelineState.audioState.audioDuration)}`;
      });

      let showingAdditionalControls = false;
      const hideAdditionalControls = () => {
        showingAdditionalControls = false;
        additionalControls.classList.remove("show");
      };

      // Handle clicks outside the web component
      document.addEventListener("click", (e) => {
        if (showingAdditionalControls && e.target !== this.shadowRoot.host) {
          hideAdditionalControls();
        }
      });

      this.shadowRoot.addEventListener("click", (e) => {
        // Handle clicks inside the web component that aren't the menu
        if (showingAdditionalControls &&
          !additionalControls.contains(e.target) &&
          !showAdditionalControlsBtn.contains(e.target)) {
          hideAdditionalControls();
        }
      });

      showAdditionalControlsBtn.addEventListener("click", () => {
        showingAdditionalControls = !showingAdditionalControls;
        additionalControls.classList.toggle("show");
      });

      const freqSwitch = root.getElementById("freq-switch");
      if (this.frequencyScale) {
        freqSwitch.setAttribute("checked", "checked");
      }
      // TODO: If frequencyScale is changed programmatically, we might want to sync the state here.
      freqSwitch.addEventListener("change", () => {
        this.frequencyScale = freqSwitch.checked.toString();
      });
      const timeSwitch = root.getElementById("time-switch");
      if (this.timeScale) {
        timeSwitch.setAttribute("checked", "checked");
      }
      timeSwitch.addEventListener("change", () => {
        this.timeScale = timeSwitch.checked.toString();
      });
      const palettes = root.querySelector(".palettes");
      const svgTick = palettes.querySelector('.svg-tick');
      for (const [color, gradient] of Object.entries(COLOR_MAPS)) {
        const button = document.createElement("input");
        button.type = "radio";
        button.name = "palette-group";
        button.id = `palette-${color}`;
        button.classList.add("radio-custom");

        const label = document.createElement("label");
        label.setAttribute("for", button.id);
        label.classList.add("radio-custom-label");
        const icon = document.createElement("canvas");
        icon.width = 16 * devicePixelRatio;
        icon.height = 16 * devicePixelRatio;
        label.appendChild(icon);
        const labelText = document.createElement("span");
        labelText.textContent = color;
        label.appendChild(labelText);
        label.appendChild(svgTick.cloneNode(true));
        palettes.appendChild(button);
        palettes.appendChild(label);
        if (this.colorScheme.toLowerCase() === color) {
          button.setAttribute("checked", "checked");
        }
        const ctx = icon.getContext("2d");
        for (let y = 0; y < icon.height; y++) {
          const slot = (y / icon.height) * gradient.length;
          const color = gradient[Math.floor(slot)];
          ctx.fillStyle = `rgb(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255})`;
          ctx.fillRect(0, y, icon.width, 1);
        }
        button.addEventListener("change", () => {
          this.colorScheme = color;
        })
      }
      // Init palette options.
    };

    setupDefaultControls();

    if (!(src && !this.inited)) {
      container.classList.add("no-src");
      // NOTE: No audio src, show ability to load from disk.
      const selectUserFileBtn = root.querySelector(".select-user-file-btn");
      const fileInput = root.querySelector(".select-user-file-input");
      selectUserFileBtn.addEventListener("click", () => {
        fileInput.click();
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length !== 0) {
          root.getElementById("container").classList.remove("no-src");
          const file = e.target.files[0];
          this.localSrc = e.target.files[0].name;
          this.loadSrc(URL.createObjectURL(file));
        }
      });
    }

    if (!this.loadingSpinner) {
      this.loadingSpinner = root.getElementById("loading-spinner");
      this.loadingSpinner.parentElement.removeChild(this.loadingSpinner);
    }
    if (!this.progressBar) {
      this.progressBar = root.getElementById("progress-bar");
      this.progressBar.parentElement.removeChild(this.progressBar);
    }
    const mainPlayheadCanvas = root.getElementById("main-playhead-canvas");
    const controls = root.getElementById("controls");
    const playButton = root.getElementById("play-button");

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
      controls.classList.add("disabled");
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
      controls.classList.remove("disabled");
      this.sharedState.interacting = false;
      this.render &&
      this.render({detail: {initialRender: false, force: true}});
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
      ctx.lineWidth = Math.max(1, devicePixelRatio / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = textColor;
      const label = "kHz";
      const labelX = ctx.canvas.width - 4 * devicePixelRatio;
      const kHzLabelY = ctx.canvas.height - 4 * devicePixelRatio;
      ctx.fillText(label, labelX, kHzLabelY);
      const cacheKey = `${label}_${pixelRatio}`;
      const textHeight =
        state.textMeasurementCache[cacheKey] ||
        ctx.measureText(label).actualBoundingBoxAscent;
      state.textMeasurementCache[cacheKey] = textHeight;

      let prevY = (kHzLabelY - textHeight * 0.5) / pixelRatio;
      const minYOffsetFromMargin = Math.abs(
        prevY - ctx.canvas.height / pixelRatio
      );
      for (let i = divisions; i >= 0; i--) {
        const yy = i / divisions;
        const yyy = this.transformY(1 - yy);
        let y = ((1 - yyy) * ctx.canvas.height) / pixelRatio;
        if (prevY - y > 15) {
          ctx.strokeRect(
            0,
            y * pixelRatio,
            ctx.canvas.width - 25 * pixelRatio,
            0
          );
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
        this.drawFrequencyScale &&
        redrawFrequencyScaleOverlay(timelineState, this.actualSampleRate);
      }
    });
    this.shadowRoot.addEventListener("audio-loaded", (e) => {
      container.classList.add("audio-loaded");
      this.drawFrequencyScale && clearOverlay();
      this.drawFrequencyScale &&
      redrawFrequencyScaleOverlay(timelineState, e.detail.sampleRate);
    });
    overlayCanvas.addEventListener("double-click", async (e) => {
      if (this.applicationHandlesDoubleClick) {
        this.shadowRoot.dispatchEvent(new CustomEvent("double-click", {
          detail: e.detail,
          composed: true,
          bubbles: false,
          cancelable: false,
        }));
      } else {
        // If there's a selected track, should we stop at the end of it?
        await play(e.detail.audioOffsetZeroOne);
      }
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
      play,
      pause,
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
        const centerX = start + (end - start) * 0.5;
        if (audioState.audioContext.state !== "running") {
          // If we start zooming to a region before the context is running, things break.
          await audioState.audioContext.resume();
        }
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
    this.redrawFrequencyScaleOverlay = () =>
      redrawFrequencyScaleOverlay(timelineState, this.actualSampleRate);

    this.enterCustomInteractionMode = () => {
      timelineState.customInteractionMode = true;
      this.timelineElements.spectrogramContainer.classList.add(
        "custom-interaction-mode"
      );
    };
    this.exitCustomInteractionMode = () => {
      timelineState.customInteractionMode = false;
      this.timelineElements.spectrogramContainer.classList.remove(
        "custom-interaction-mode"
      );
    };
    this.beginCustomInteraction = () => {
      timelineState.inCustomInteraction = true;
    };
    this.endCustomInteraction = () => {
      timelineState.inCustomInteraction = false;
    };

    this.resizeCanvases = (resizedWidth, forReal) => {
      const width = resizedWidth || container.getBoundingClientRect().width;
      this.timelineElements.canvasContainer.style.height = `${this.spectrogramHeight}px`;
      this.timelineElements.miniMapContainer.style.height = `${this.timelineHeight}px`;
      const initialWidth = this.timelineElements.canvas.width;
      resizeCanvas(
        this.timelineElements.canvas,
        width,
        this.spectrogramHeight,
        forReal
      );
      resizeCanvas(
        this.timelineElements.timescaleCanvas,
        width,
        Math.max(20, Math.min(30, this.spectrogramHeight / 10)),
        true
      );
      resizeCanvas(
        this.timelineElements.overlayCanvas,
        width,
        this.spectrogramHeight,
        true
      );
      resizeCanvas(
        this.timelineElements.userOverlayCanvas,
        width,
        this.spectrogramHeight,
        true
      );

      resizeCanvas(
        this.timelineElements.mapCanvas,
        width,
        this.timelineHeight,
        forReal
      );
      resizeCanvas(
        this.timelineElements.timelineUICanvas,
        width,
        this.timelineHeight,
        true
      );

      resizeCanvas(
        this.playerElements.mainPlayheadCanvas,
        width,
        this.spectrogramHeight,
        true
      );
      resizeCanvas(
        this.playerElements.playheadCanvas,
        width,
        this.timelineHeight,
        true
      );
      let didChangeWidth = false;
      const willChangeWidth =
        width * devicePixelRatio !== this.timelineElements.canvas.width;
      if (forReal) {
        didChangeWidth =
          this.deferredWidth &&
          this.timelineElements.canvas.width ===
          this.deferredWidth * devicePixelRatio &&
          this.deferredWidth !== initialWidth;
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
            this.drawFrequencyScale &&
            redrawFrequencyScaleOverlay(timelineState, this.actualSampleRate);
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
    if (lazyLoad) {
      const intersectionObserver = new IntersectionObserver((intersection) => {
        if (intersection[0].isIntersecting && src && src !== "null" && src !== "undefined") {
          this.loadSrc(src);
          intersectionObserver.disconnect();
        }
      }, {
        rootMargin: '50px',
        threshold: 0.1
      });
      intersectionObserver.observe(container);
    } else {
      // Initial attributeChangedCallback happens before connectedCallback, so need to load src after initial one-time setup.
      if (src && src !== "null" && src !== "undefined") {
        // NOTE: Vue initially passes `null` or `undefined` to src, which gets stringified.
        this.loadSrc(src);
      }
    }
  }
}
if (!customElements.get("spectastiq-viewer")) {
  customElements.define("spectastiq-viewer", Spectastiq);
}
