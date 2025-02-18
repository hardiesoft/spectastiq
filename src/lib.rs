use std::sync::Arc;
use log::{Level};
use wasm_bindgen::prelude::*;

#[allow(unused)]
use log::{info, trace, warn};

use rustfft::{Fft, FftPlanner};
use rustfft::{num_complex::Complex};

const OVERLAP: f32 = 0.95;
const CHUNK_LEN: usize = 2048;
const HALF_CHUNK_LEN: usize = CHUNK_LEN / 2;
const STEP: usize = (CHUNK_LEN as f32 * (1.0 - OVERLAP)) as usize;

#[wasm_bindgen]
pub struct FftContext {
    fft: Arc<dyn Fft<f32>>,
    filter: [f32; CHUNK_LEN],
    scratch: [Complex<f32>; CHUNK_LEN],
    filtered: [Complex<f32>; CHUNK_LEN],
}

#[wasm_bindgen]
impl FftContext {
    pub fn new() -> FftContext {
        init_console();
        let mut planner = FftPlanner::new();
        let fft = planner.plan_fft_forward(CHUNK_LEN);
        FftContext {
            fft,
            filter: init_blackman_harris(),
            scratch: [Complex{re: 0.0f32, im: 0.0f32}; CHUNK_LEN],
            filtered: [Complex{re: 0.0f32, im: 0.0f32}; CHUNK_LEN],
        }
    }

    #[wasm_bindgen(js_name = processAudio)]
    pub fn process_audio(&mut self, prelude: &[f32], data: &[f32], output: &mut [f32]) {
        let len = data.len() + prelude.len();
        let width = output.len() / HALF_CHUNK_LEN;
        // Chunkify:
        let num_chunks = {
            let mut i = 0;
            let mut chunks = 0;
            while i + CHUNK_LEN <= len {
                i += STEP;
                chunks += 1;
            }
            if i == len {
                chunks -= 1;
            }
            chunks
        } as f32;
        let chunk_width_ratio = num_chunks / width as f32;
        let fft = &self.fft;
        let scratch = &mut self.scratch[..];
        let mut j = 0.0;
        let mut n = 0;

        // sliding window function across output, which is 1024 wide
        // equiv: &mut output.windows(half_chunk_len);//s[n * half_chunk_len..(n + 1) * half_chunk_len]
        while n < width {
            let p = j as usize * STEP;
            transform(
                fft,
                &mut output[n * HALF_CHUNK_LEN..(n + 1) * HALF_CHUNK_LEN],
                scratch,
                &mut self.filtered,
                prelude.iter().chain(data.iter()).skip(p).take(CHUNK_LEN),
                &self.filter,
            );
            j += chunk_width_ratio;
            n += 1;
        }
    }
}

fn init_console() {
    console_error_panic_hook::set_once();
    console_log::init_with_level(Level::Info).unwrap_or_else(|_| ());
}

fn blackman_harris_filter(n: f32, samples: f32) -> f32 {
    // Blackman harris
    const A0: f32 = 0.35875;
    const A1: f32 = 0.48829;
    const A2: f32 = 0.14128;
    const A3: f32 = 0.01168;
    let arg = 2.0 * std::f32::consts::PI * n / (samples - 1.0);
    A0 - A1 * f32::cos(arg) + A2 * f32::cos(2.0 * arg) - A3 * f32::cos(3.0 * arg)
}

fn transform<'a>(
    fft: &Arc<dyn Fft<f32>>,
    result: &mut [f32],
    scratch: &mut [Complex<f32>],
    filtered_scratch: &mut [Complex<f32>],
    signal: impl Iterator<Item = &'a f32>,
    window_fn_cache: &[f32; CHUNK_LEN],
) {
    for ((val, filter), out) in signal.zip(window_fn_cache).zip(&mut filtered_scratch[..]) {
        *out = Complex::new(val * filter, 0.0);
    }
    fft.process_with_scratch(filtered_scratch, &mut scratch[..]);
    // NOTE: We only need half of the output, since it is mirrored.
    let first_half = filtered_scratch.split_at((filtered_scratch.len() + 1) / 2).0;
    for (input, output) in first_half.iter().zip(result) {
        let val = input.scale(10000.0 * 1000.0).norm();
        *output = val;
    }
}

fn init_blackman_harris() -> [f32; CHUNK_LEN] {
    let mut filter = [0.0; CHUNK_LEN];
    for i in 0..CHUNK_LEN {
        filter[i] = blackman_harris_filter(i as f32, CHUNK_LEN as f32);
    }
    filter
}
