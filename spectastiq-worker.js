let wasm;

let cachedUint8Memory0 = null;

function getUint8Memory0() {
  if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
    cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8Memory0;
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8Memory0().subarray(ptr / 1, ptr / 1 + len);
}

const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

function getObject(idx) { return heap[idx]; }

let heap_next = heap.length;

function dropObject(idx) {
  if (idx < 132) return;
  heap[idx] = heap_next;
  heap_next = idx;
}

function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}

function isLikeNone(x) {
  return x === undefined || x === null;
}

let cachedFloat64Memory0 = null;

function getFloat64Memory0() {
  if (cachedFloat64Memory0 === null || cachedFloat64Memory0.byteLength === 0) {
    cachedFloat64Memory0 = new Float64Array(wasm.memory.buffer);
  }
  return cachedFloat64Memory0;
}

let cachedInt32Memory0 = null;

function getInt32Memory0() {
  if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
    cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32Memory0;
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

function addHeapObject(obj) {
  if (heap_next === heap.length) heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];

  heap[idx] = obj;
  return idx;
}

function debugString(val) {
  // primitive types
  const type = typeof val;
  if (type == 'number' || type == 'boolean' || val == null) {
    return  `${val}`;
  }
  if (type == 'string') {
    return `"${val}"`;
  }
  if (type == 'symbol') {
    const description = val.description;
    if (description == null) {
      return 'Symbol';
    } else {
      return `Symbol(${description})`;
    }
  }
  if (type == 'function') {
    const name = val.name;
    if (typeof name == 'string' && name.length > 0) {
      return `Function(${name})`;
    } else {
      return 'Function';
    }
  }
  // objects
  if (Array.isArray(val)) {
    const length = val.length;
    let debug = '[';
    if (length > 0) {
      debug += debugString(val[0]);
    }
    for(let i = 1; i < length; i++) {
      debug += ', ' + debugString(val[i]);
    }
    debug += ']';
    return debug;
  }
  // Test for built-in
  const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
  let className;
  if (builtInMatches.length > 1) {
    className = builtInMatches[1];
  } else {
    // Failed to match the standard '[object ClassName]'
    return toString.call(val);
  }
  if (className == 'Object') {
    // we're a user defined class or Object
    // JSON.stringify avoids problems with cycles, and is generally much
    // easier than looping through ownProperties of `val`.
    try {
      return 'Object(' + JSON.stringify(val) + ')';
    } catch (_) {
      return 'Object';
    }
  }
  // errors
  if (val instanceof Error) {
    return `${val.name}: ${val.message}\n${val.stack}`;
  }
  // TODO we could test for more things here, like `Set`s and `Map`s.
  return className;
}

let WASM_VECTOR_LEN = 0;

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
  ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
  }
  : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  });

function passStringToWasm0(arg, malloc, realloc) {

  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length) >>> 0;
    getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
  }

  let len = arg.length;
  let ptr = malloc(len) >>> 0;

  const mem = getUint8Memory0();

  let offset = 0;

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7F) break;
    mem[ptr + offset] = code;
  }

  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3) >>> 0;
    const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
    const ret = encodeString(arg, view);

    offset += ret.written;
  }

  WASM_VECTOR_LEN = offset;
  return ptr;
}

function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1) >>> 0;
  getUint8Memory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
/**
 * @param {Uint8Array} bytes
 * @returns {Float32Array}
 */
export function decode_mp3(bytes) {
  const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_mp3(ptr0, len0);
  return takeObject(ret);
}

let cachedFloat32Memory0 = null;

function getFloat32Memory0() {
  if (cachedFloat32Memory0 === null || cachedFloat32Memory0.byteLength === 0) {
    cachedFloat32Memory0 = new Float32Array(wasm.memory.buffer);
  }
  return cachedFloat32Memory0;
}

function passArrayF32ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 4) >>> 0;
  getFloat32Memory0().set(arg, ptr / 4);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
/**
 */
export function toggle_playback() {
  wasm.toggle_playback();
}

/**
 * @param {any} x
 * @param {any} y
 */
export function start_selection(x, y) {
  wasm.start_selection(addHeapObject(x), addHeapObject(y));
}

/**
 * @param {any} x
 * @param {any} y
 */
export function update_selection(x, y) {
  wasm.update_selection(addHeapObject(x), addHeapObject(y));
}

/**
 * @param {any} x
 * @param {any} y
 */
export function end_selection(x, y) {
  wasm.end_selection(addHeapObject(x), addHeapObject(y));
}

/**
 * @param {number} max
 * @param {Float32Array} data
 * @param {number} y_offset
 * @param {number} HEIGHT
 * @param {number} length
 * @param {number} padding
 * @returns {any}
 */
export function trim(max, data, y_offset, HEIGHT, length, padding) {
  const ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.trim(max, ptr0, len0, y_offset, HEIGHT, length, padding);
  return takeObject(ret);
}

/**
 * @param {number} max
 * @param {Float32Array} data
 * @param {number} y_offset
 * @param {number} width
 * @param {number} height
 * @param {number} padding
 * @returns {Uint8ClampedArray}
 */
export function render(max, data, y_offset, width, height, padding) {
  const ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.render(max, ptr0, len0, y_offset, width, height, padding);
  return takeObject(ret);
}

/**
 */
export function init_logger() {
  wasm.init_logger();
}

/**
 * @param {Uint8Array} bytes
 * @returns {number}
 */
export function get_last_frame_ending(bytes) {
  const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.get_last_frame_ending(ptr0, len0);
  return ret >>> 0;
}

function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm.__wbindgen_exn_store(addHeapObject(e));
  }
}
/**
 */
export class FftContext {

  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(FftContext.prototype);
    obj.__wbg_ptr = ptr;

    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;

    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_fftcontext_free(ptr);
  }
  /**
   * @returns {FftContext}
   */
  static new() {
    const ret = wasm.fftcontext_new();
    return FftContext.__wrap(ret);
  }
  /**
   * @param {Float32Array} prelude
   * @param {Float32Array} data
   * @param {Float32Array} output
   * @returns {number}
   */
  process_audio(prelude, data, output) {
    const ptr0 = passArrayF32ToWasm0(prelude, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(data, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = passArrayF32ToWasm0(output, wasm.__wbindgen_malloc);
    var len2 = WASM_VECTOR_LEN;
    const ret = wasm.fftcontext_process_audio(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, addHeapObject(output));
    return ret;
  }
}
/**
 */
export class SpectasticContext {

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;

    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_spectasticcontext_free(ptr);
  }
}

async function __wbg_load(module, imports) {
  if (typeof Response === 'function' && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === 'function') {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);

      } catch (e) {
        if (module.headers.get('Content-Type') != 'application/wasm') {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

        } else {
          throw e;
        }
      }
    }

    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);

  } else {
    const instance = await WebAssembly.instantiate(module, imports);

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };

    } else {
      return instance;
    }
  }
}

function __wbg_get_imports() {
  const imports = {};
  imports.wbg = {};
  imports.wbg.__wbindgen_copy_to_typed_array = function(arg0, arg1, arg2) {
    new Uint8Array(getObject(arg2).buffer, getObject(arg2).byteOffset, getObject(arg2).byteLength).set(getArrayU8FromWasm0(arg0, arg1));
  };
  imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
    takeObject(arg0);
  };
  imports.wbg.__wbindgen_number_get = function(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = typeof(obj) === 'number' ? obj : undefined;
    getFloat64Memory0()[arg0 / 8 + 1] = isLikeNone(ret) ? 0 : ret;
    getInt32Memory0()[arg0 / 4 + 0] = !isLikeNone(ret);
  };
  imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_new_abda76e883ba8a5f = function() {
    const ret = new Error();
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_stack_658279fe44541cf6 = function(arg0, arg1) {
    const ret = getObject(arg1).stack;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
  };
  imports.wbg.__wbg_error_f851667af71bcfc6 = function(arg0, arg1) {
    let deferred0_0;
    let deferred0_1;
    try {
      deferred0_0 = arg0;
      deferred0_1 = arg1;
      console.error(getStringFromWasm0(arg0, arg1));
    } finally {
      wasm.__wbindgen_free(deferred0_0, deferred0_1);
    }
  };
  imports.wbg.__wbg_debug_e3f6a1578e6d45ca = function(arg0) {
    console.debug(getObject(arg0));
  };
  imports.wbg.__wbg_error_a7e23606158b68b9 = function(arg0) {
    console.error(getObject(arg0));
  };
  imports.wbg.__wbg_info_05db236d79f1b785 = function(arg0) {
    console.info(getObject(arg0));
  };
  imports.wbg.__wbg_log_dc06ec929fc95a20 = function(arg0) {
    console.log(getObject(arg0));
  };
  imports.wbg.__wbg_warn_9bdd743e9f5fe1e0 = function(arg0) {
    console.warn(getObject(arg0));
  };
  imports.wbg.__wbg_now_c97f243e7947c4ac = function(arg0) {
    const ret = getObject(arg0).now();
    return ret;
  };
  imports.wbg.__wbg_newnoargs_c9e6043b8ad84109 = function(arg0, arg1) {
    const ret = new Function(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_get_f53c921291c381bd = function() { return handleError(function (arg0, arg1) {
    const ret = Reflect.get(getObject(arg0), getObject(arg1));
    return addHeapObject(ret);
  }, arguments) };
  imports.wbg.__wbg_call_557a2f2deacc4912 = function() { return handleError(function (arg0, arg1) {
    const ret = getObject(arg0).call(getObject(arg1));
    return addHeapObject(ret);
  }, arguments) };
  imports.wbg.__wbindgen_object_clone_ref = function(arg0) {
    const ret = getObject(arg0);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_self_742dd6eab3e9211e = function() { return handleError(function () {
    const ret = self.self;
    return addHeapObject(ret);
  }, arguments) };
  imports.wbg.__wbg_window_c409e731db53a0e2 = function() { return handleError(function () {
    const ret = window.window;
    return addHeapObject(ret);
  }, arguments) };
  imports.wbg.__wbg_globalThis_b70c095388441f2d = function() { return handleError(function () {
    const ret = globalThis.globalThis;
    return addHeapObject(ret);
  }, arguments) };
  imports.wbg.__wbg_global_1c72617491ed7194 = function() { return handleError(function () {
    const ret = global.global;
    return addHeapObject(ret);
  }, arguments) };
  imports.wbg.__wbindgen_is_undefined = function(arg0) {
    const ret = getObject(arg0) === undefined;
    return ret;
  };
  imports.wbg.__wbg_buffer_55ba7a6b1b92e2ac = function(arg0) {
    const ret = getObject(arg0).buffer;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_newwithbyteoffsetandlength_bdbaa1f122acbad2 = function(arg0, arg1, arg2) {
    const ret = new Uint8ClampedArray(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_newwithbyteoffsetandlength_ab5b524f83702d8d = function(arg0, arg1, arg2) {
    const ret = new Float32Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_debug_string = function(arg0, arg1) {
    const ret = debugString(getObject(arg1));
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
  };
  imports.wbg.__wbindgen_throw = function(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
  };
  imports.wbg.__wbindgen_memory = function() {
    const ret = wasm.memory;
    return addHeapObject(ret);
  };

  return imports;
}

function __wbg_init_memory(imports, maybe_memory) {

}

function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  __wbg_init.__wbindgen_wasm_module = module;
  cachedFloat32Memory0 = null;
  cachedFloat64Memory0 = null;
  cachedInt32Memory0 = null;
  cachedUint8Memory0 = null;


  return wasm;
}

function initSync(module) {
  if (wasm !== undefined) return wasm;

  const imports = __wbg_get_imports();

  __wbg_init_memory(imports);

  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }

  const instance = new WebAssembly.Instance(module, imports);

  return __wbg_finalize_init(instance, module);
}

async function __wbg_init(input) {
  if (wasm !== undefined) return wasm;

  if (typeof input === 'undefined') {
    input = new URL('./spectastic_bg.wasm', import.meta.url);
  }
  const imports = __wbg_get_imports();

  if (typeof input === 'string' || (typeof Request === 'function' && input instanceof Request) || (typeof URL === 'function' && input instanceof URL)) {
    input = fetch(input);
  }

  __wbg_init_memory(imports);

  const { instance, module } = await __wbg_load(await input, imports);

  return __wbg_finalize_init(instance, module);
}

let ctx;
// FIXME: We should fetch the wasm once, then pass it to each worker for initialisation.
self.onmessage = async ({data}) => {
  if (data.type === "Process") {
    //let s = performance.now();
    // TODO: Unnecessary memory copying of these arrays happening here: - would it actually be faster to process in JS?
    const max = ctx.process_audio(data.prelude, data.data, data.output);
    console.log(max);
    //console.log(performance.now() - s, self.name);
    self.postMessage({
      id: data.id,
      n: self.name,
      max
    });
  } else if (data.type === "Init") {
    await __wbg_init(data.wasm);
    init_logger();
    ctx = FftContext.new();
    self.postMessage({
      id: data.id,
      m: "Inited", n: self.name
    });
  }
}
