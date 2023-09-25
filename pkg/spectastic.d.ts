/* tslint:disable */
/* eslint-disable */
/**
* @param {Uint8Array} bytes
* @returns {Float32Array}
*/
export function decode_mp3(bytes: Uint8Array): Float32Array;
/**
*/
export function toggle_playback(): void;
/**
* @param {any} x
* @param {any} y
*/
export function start_selection(x: any, y: any): void;
/**
* @param {any} x
* @param {any} y
*/
export function update_selection(x: any, y: any): void;
/**
* @param {any} x
* @param {any} y
*/
export function end_selection(x: any, y: any): void;
/**
* @param {number} max
* @param {Float32Array} data
* @param {number} y_offset
* @param {number} HEIGHT
* @param {number} length
* @param {number} padding
* @returns {any}
*/
export function trim(max: number, data: Float32Array, y_offset: number, HEIGHT: number, length: number, padding: number): any;
/**
* @param {number} max
* @param {Float32Array} data
* @param {number} y_offset
* @param {number} width
* @param {number} height
* @param {number} padding
* @returns {Uint8ClampedArray}
*/
export function render(max: number, data: Float32Array, y_offset: number, width: number, height: number, padding: number): Uint8ClampedArray;
/**
*/
export function init_logger(): void;
/**
* @param {Uint8Array} bytes
* @returns {number}
*/
export function get_last_frame_ending(bytes: Uint8Array): number;
/**
*/
export class FftContext {
  free(): void;
/**
* @returns {FftContext}
*/
  static new(): FftContext;
/**
* @param {Float32Array} prelude
* @param {Float32Array} data
* @param {Float32Array} output
* @returns {number}
*/
  process_audio(prelude: Float32Array, data: Float32Array, output: Float32Array): number;
}
/**
*/
export class SpectasticContext {
  free(): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly decode_mp3: (a: number, b: number) => number;
  readonly __wbg_fftcontext_free: (a: number) => void;
  readonly fftcontext_new: () => number;
  readonly fftcontext_process_audio: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
  readonly __wbg_spectasticcontext_free: (a: number) => void;
  readonly toggle_playback: () => void;
  readonly start_selection: (a: number, b: number) => void;
  readonly update_selection: (a: number, b: number) => void;
  readonly end_selection: (a: number, b: number) => void;
  readonly trim: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  readonly render: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  readonly init_logger: () => void;
  readonly get_last_frame_ending: (a: number, b: number) => number;
  readonly __wbindgen_malloc: (a: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number) => number;
  readonly __wbindgen_free: (a: number, b: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
