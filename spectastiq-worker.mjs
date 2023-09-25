import spectastiq, {init_logger, FftContext} from './pkg/spectastiq-backend.js';
let ctx;
// FIXME: We should fetch the wasm once, then pass it to each worker for initialisation.
self.onmessage = async ({data}) => {
  if (data.type === "Process") {
    //let s = performance.now();
    // TODO: Unnecessary memory copying of these arrays happening here: - would it actually be faster to process in JS?
    const max = ctx.process_audio(data.prelude, data.data, data.output);
    //console.log(performance.now() - s, self.name);
    self.postMessage({
      id: data.id,
      n: self.name,
      max
    });
  } else if (data.type === "Init") {
    await spectastiq();
    init_logger();
    ctx = FftContext.new();
    self.postMessage({
      id: data.id,
      m: "Inited", n: self.name
    });
  }
}
