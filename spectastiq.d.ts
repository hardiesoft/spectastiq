declare class Spectastiq extends HTMLElement {
  selectRegionOfInterest: (
    startZeroOne: number,
    endZeroOne: number,
    minZeroOne: number,
    maxZeroOne: number
  ) => Promise<void>;
  setPlaybackFrequencyBandPass: (minFreqHz: number, maxFreqHz: number) => void;
  removePlaybackFrequencyBandPass: () => void;
  enterRegionCreationMode: () => void;
  exitRegionCreationMode: () => void;
  resetYZoom: () => void;
  transformY: (y: number) => number;
  play: (startAtOffsetZeroOne?: number) => Promise<void>;
  pause: (stopAtOffsetZeroOne?: number) => Promise<void>;
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

interface SpectastiqRegionCreationEvent
  extends CustomEvent<RegionCreationEvent> {
  type: "region-create";
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
    "region-create": SpectastiqRegionCreationEvent;
  }
}
