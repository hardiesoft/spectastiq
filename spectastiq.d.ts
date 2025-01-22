declare class Spectastiq extends HTMLElement {
  selectRegionOfInterest: (
    startZeroOne: number,
    endZeroOne: number,
    minZeroOne: number,
    maxZeroOne: number
  ) => void;
  setPlaybackFrequencyBandPass: (minFreqHz: number, maxFreqHz: number) => void;
  removePlaybackFrequencyBandPass: () => void;
  enterRegionCreationMode: () => void;
  exitRegionCreationMode: () => void;
  resetYZoom: () => void;
  transformY: (y: number) => number;
  togglePlayback: () => boolean;
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
  container: HTMLDivElement;
}

interface PlayheadChangeEvent {
  timeInSeconds: number;
  totalDurationInSeconds: number;
}

interface InteractionCoordinatesEvent {
  offsetX: number;
  offsetY: number;
}

interface RegionCreationEvent {
  start: number;
  end: number;
  minFreqHz: number;
  maxFreqHz: number;
}

export interface SpectastiqRenderEvent extends CustomEvent<RangeChangeEvent> {
  type: "render";
}

export interface SpectastiqPlayheadEvent extends CustomEvent<PlayheadChangeEvent> {
  type: "playhead-update";
}

interface SpectastiqLoadedEvent extends Event {
  type: "loaded";
}

interface SpectastiqPointerMoveEvent extends CustomEvent<InteractionCoordinatesEvent> {
  type: "spectastiq-pointermove";
}

interface SpectastiqSelectEvent extends CustomEvent<InteractionCoordinatesEvent> {
  type: "spectastiq-select";
}

interface SpectastiqRegionCreationEvent extends CustomEvent<RegionCreationEvent> {
  type: "spectastiq-region-create";
}

declare global {
  interface HTMLElementTagNameMap {
    "spectastiq-viewer": Spectastiq;
  }
  interface HTMLElementEventMap {
    render: SpectastiqRenderEvent;
    loaded: SpectastiqLoadedEvent;
    "playhead-update": SpectastiqPlayheadEvent;
    "spectastiq-pointermove": SpectastiqPointerMoveEvent;
    "spectastiq-select": SpectastiqSelectEvent;
    "spectastiq-region-create": SpectastiqRegionCreationEvent;
  }
}
