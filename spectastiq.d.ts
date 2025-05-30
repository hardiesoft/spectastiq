declare class Spectastiq extends HTMLElement {
  selectRegionOfInterest: (
    startZeroOne: number,
    endZeroOne: number,
    minZeroOne: number,
    maxZeroOne: number
  ) => Promise<void>;
  setPlaybackFrequencyBandPass: (minFreqHz: number, maxFreqHz: number) => void;
  getGainForRegionOfInterest: (startZeroOne: number, endZeroOne: number, minZeroOne: number, maxZeroOne: number) => number;
  removePlaybackFrequencyBandPass: () => void;
  enterCustomInteractionMode: () => void;
  exitCustomInteractionMode: () => void;
  beginCustomInteraction: () => void;
  endCustomInteraction: () => void;
  resetYZoom: () => void;
  transformY: (y: number) => number;
  inverseTransformY: (yZeroOne: number) => number;
  play: (startAtOffsetZeroOne?: number, endAtOffsetZeroOne?: number) => Promise<void>;
  pause: () => void;
  setGain: (gain: number) => number;
  nextPalette: () => string;
}

interface RangeChangeEvent {
  range: {
    begin: number;
    end: number;
    min: number;
    max: number;
  };
  sampleRate: number;
  duration: number;
  context: CanvasRenderingContext2D;
}

interface PlayheadChangeEvent {
  timeInSeconds: number;
}

interface DoubleClickEvent {
  audioOffsetZeroOne: number;
}

interface InteractionCoordinatesEvent {
  offsetX: number;
  offsetY: number;
  container: HTMLElement;
}

interface AudioLoadEvent {
  sampleRate: number;
  duration: number;
}

// Dispatched every time spectastiq re-renders the spectrogram.
export interface SpectastiqRenderEvent extends CustomEvent<RangeChangeEvent> {
  type: "render";
}

// Dispatched each time the playhead is redrawn.
export interface SpectastiqPlayheadEvent
  extends CustomEvent<PlayheadChangeEvent> {
  type: "playhead-update";
}

// Dispatched when the audio has finished downloading and decoding and the initial spectrogram is rendered.
interface SpectastiqLoadedEvent extends CustomEvent<AudioLoadEvent> {
  type: "audio-loaded";
}

// Dispatched when spectastic has initialised, but before the audio has finished downloading.
interface SpectastiqReadyEvent extends Event {
  type: "ready";
}

// Dispatched whenever spectastiq audio playback is paused
interface SpectastiqPlaybackEndedEvent extends Event {
  type: "playback-ended";
}

// Dispatched each time spectastiq audio playback is started
interface SpectastiqPlaybackStartedEvent extends Event {
  type: "playback-started";
}

// Dispatched when the mouse pointer moves over the spectastiq canvases
interface SpectastiqPointerMoveEvent
  extends CustomEvent<InteractionCoordinatesEvent> {
  type: "move";
}

// Dispatched when the pointer is 'clicked' over the spectrogram - can be handled by integrations to
// interact with items drawn on the user-overlay canvas
interface SpectastiqSelectEvent
  extends CustomEvent<InteractionCoordinatesEvent> {
  type: "select";
}

// Dispatched when a custom interaction starts (pointerdown) if an extension has put spectastiq in custom-interaction mode.
// While in this mode, spectastic doesn't handle things like panning etc; this is delegated to the host application.
interface SpectastiqCustomInteractionStartEvent
  extends CustomEvent<InteractionCoordinatesEvent> {
  type: "custom-interaction-start";
}

// Dispatched when the pointer moves if an extension has put spectastiq in custom-interaction mode.
// While in this mode, spectastic doesn't handle things like panning etc; this is delegated to the host application.
interface SpectastiqCustomInteractionMoveEvent
  extends CustomEvent<InteractionCoordinatesEvent> {
  type: "custom-interaction-move";
}

// Dispatched when a custom interaction ends (pointerup) if an extension has put spectastiq in custom-interaction mode.
// While in this mode, spectastic doesn't handle things like panning etc; this is delegated to the host application.
interface SpectastiqCustomInteractionEndEvent
  extends CustomEvent<InteractionCoordinatesEvent> {
  type: "custom-interaction-end";
}

// Dispatched when a double click/tap event occurs if the host application has indicated it wants to handle this
// interaction – otherwise the default action is to play audio from the selected time offset.
interface SpectastiqDoubleClickEvent
  extends CustomEvent<DoubleClickEvent> {
  type: "double-click";
}

declare global {
  interface HTMLElementTagNameMap {
    "spectastiq-viewer": Spectastiq;
  }
  interface HTMLElementEventMap {
    render: SpectastiqRenderEvent;
    "audio-loaded": SpectastiqLoadedEvent;
    ready: SpectastiqReadyEvent;
    "playhead-update": SpectastiqPlayheadEvent;
    "playback-started": SpectastiqPlaybackStartedEvent;
    "playback-ended": SpectastiqPlaybackEndedEvent;
    move: SpectastiqPointerMoveEvent;
    select: SpectastiqSelectEvent;
    "custom-interaction-start": SpectastiqCustomInteractionStartEvent;
    "custom-interaction-move": SpectastiqCustomInteractionMoveEvent;
    "custom-interaction-end": SpectastiqCustomInteractionEndEvent;
    "double-click": SpectastiqDoubleClickEvent;
  }
}
