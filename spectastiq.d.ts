declare class Spectastiq extends HTMLElement {
  selectRegionOfInterest: (
    startZeroOne: number,
    endZeroOne: number,
    minZeroOne: number,
    maxZeroOne: number
  ) => void;
  setPlaybackFrequencyBandPass: (minFreqHz: number, maxFreqHz: number) => void;
  removePlaybackFrequencyBandPass: () => void;

  resetYZoom: () => void;

  transformY: (y: number) => number;
  requestRedraw: () => void;
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
}

interface PlayheadChangeEvent {
  timeInSeconds: number;
  totalDurationInSeconds: number;
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

declare global {
  interface HTMLElementTagNameMap {
    "spectastiq-viewer": Spectastiq;
  }
  interface HTMLElementEventMap {
    render: SpectastiqRenderEvent;
    loaded: SpectastiqLoadedEvent;
    "playhead-update": SpectastiqPlayheadEvent;
  }
}
