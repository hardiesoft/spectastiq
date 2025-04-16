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

interface InteractionCoordinatesEvent {
  offsetX: number;
  offsetY: number;
  container: HTMLElement;
}

interface RegionCreationEvent {
  start: number;
  end: number;
  minFreqHz: number;
  maxFreqHz: number;
}

interface AudioLoadEvent {
  sampleRate: number;
  duration: number;
}

export interface SpectastiqRenderEvent extends CustomEvent<RangeChangeEvent> {
  type: "render";
}

export interface SpectastiqPlayheadEvent
  extends CustomEvent<PlayheadChangeEvent> {
  type: "playhead-update";
}

interface SpectastiqLoadedEvent extends CustomEvent<AudioLoadEvent> {
  type: "audio-loaded";
}

interface SpectastiqReadyEvent extends Event {
  type: "ready";
}

interface SpectastiqPlaybackEndedEvent extends Event {
  type: "playback-ended";
}

interface SpectastiqPlaybackStartedEvent extends Event {
  type: "playback-started";
}

interface SpectastiqPointerMoveEvent
  extends CustomEvent<InteractionCoordinatesEvent> {
  type: "move";
}

interface SpectastiqSelectEvent
  extends CustomEvent<InteractionCoordinatesEvent> {
  type: "select";
}

interface SpectastiqCustomInteractionStartEvent
  extends CustomEvent<InteractionCoordinatesEvent> {
  type: "custom-interaction-start";
}

interface SpectastiqCustomInteractionMoveEvent
  extends CustomEvent<InteractionCoordinatesEvent> {
  type: "custom-interaction-move";
}
interface SpectastiqCustomInteractionEndEvent
  extends CustomEvent<InteractionCoordinatesEvent> {
  type: "custom-interaction-end";
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
  }
}
