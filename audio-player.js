import {mapRange} from "./webgl-drawimage.js";

export const initAudioPlayer = (
  root,
  sharedState,
  timelineState,
  playerElements,
) => {
  const audioContext = new AudioContext({ sampleRate: 48000 });
  const gainNode = audioContext.createGain();
  const filterNode = audioContext.createBiquadFilter();
  filterNode.type = "allpass";
  const volume = 1.0;
  setGain(gainNode, volume);

  const state = {
    audioNodes: {
      gainNode,
      filterNode,
    },
    audioContext,
    audioProgressZeroOne: 0,
    playbackStartOffset: 0,
    progressSampleTime: 0,
    playing: false,
    audioStatusPoll: 0,
    capturedElement: null,
    wasPlaying: false,
    playheadStartOffsetXZeroOne: 0,
    playheadDragOffsetX: 0,
    followPlayhead: false,
    mainPlayheadStartOffsetXZeroOne: 0,
    mainPlayheadDragOffsetX: 0,
    dragPlayheadRaf: 0,
    playheadWasInRangeWhenPlaybackStarted: false,
    root,
  };

  playerElements.playButton.addEventListener("click", async () => {
    await togglePlayback(state, timelineState, sharedState, playerElements);
  });

  return {
    audioState: state,
    updatePlayhead: (beganPlaying = false, rangeChange = false, ) =>
      updatePlayhead(
        state,
        timelineState,
        sharedState,
        playerElements,
        beganPlaying,
        rangeChange
      ),
    setPlaybackOffset: (offsetZeroOne) =>
      setPlaybackTime(offsetZeroOne, state, playerElements),
    setBandPass: (minFreq, maxFreq) =>
      setBandPass(filterNode, minFreq, maxFreq),
    removeBandPass: () => removeBandPass(filterNode),
    setGain: (volume) => setGain(gainNode, volume),
    pause: () => pauseAudio(state, timelineState, sharedState, playerElements),
    play: (startOffsetZeroOne, stopOffsetZeroOne) => playAudio(state, timelineState, sharedState, playerElements, startOffsetZeroOne, stopOffsetZeroOne),
    togglePlayback: () => togglePlayback(state, timelineState, sharedState, playerElements),
    startPlayheadDrag: () => startPlayheadDrag(state, timelineState, sharedState, playerElements),
    endPlayheadDrag: () => endPlayheadDrag(state, timelineState, sharedState, playerElements),
    dragLocalPlayhead: (x) => dragLocalPlayhead(x, state, timelineState, sharedState, playerElements),
    dragGlobalPlayhead: (x) => dragGlobalPlayhead(x, state, timelineState, sharedState, playerElements),
  };
};

const removeBandPass = (biQuadFilterNode) => {
  // Does this really turn things off properly?
  biQuadFilterNode.type = "allpass";
};

const setBandPass = (biQuadFilterNode, minFreq, maxFreq) => {
  minFreq = Math.min(maxFreq, Math.max(100, minFreq));
  biQuadFilterNode.type = "bandpass";
  const freqCenter = minFreq + (maxFreq - minFreq) * 0.5;
  const freqDelta = Math.max(100, maxFreq - minFreq);
  // This is how "wide" the filter bell-curve is around the center as a ratio?
  const QFactor = freqCenter / freqDelta;
  biQuadFilterNode.frequency.value = freqCenter;
  biQuadFilterNode.Q.value = QFactor;
};

const setGain = (gainNode, volume) => {
  gainNode.gain.value = volume;
  return gainNode.gain.value;
};

const startPlayheadDrag = (state, timelineState, sharedState, playerElements) => {
    state.wasPlaying = state.playing;
    if (state.playing) {
      pauseAudio(state, timelineState, sharedState, playerElements, state.audioProgressZeroOne);
    }
};

const endPlayheadDrag = (
  state,
  timelineState,
  sharedState,
  playerElements
) => {
  if (state.wasPlaying) {
    playAudio(state, timelineState, sharedState, playerElements, state.audioProgressZeroOne).then(() => {
      // Do nothing
    });
  }
};


const dragGlobalPlayhead = (xZeroOne, state, timelineState, sharedState, playerElements) => {
    const thisOffsetXZeroOne = Math.max(
      0,
      Math.min(xZeroOne, 1)
    );
    cancelAnimationFrame(state.dragPlayheadRaf);
    if (state.audioContext.state !== "running") {
      // Update the playhead anyway.
      state.audioProgressZeroOne = thisOffsetXZeroOne;
      updatePlayhead(state, timelineState, sharedState, playerElements);
    }
    state.dragPlayheadRaf = requestAnimationFrame(async () => {
      state.audioProgressZeroOne = thisOffsetXZeroOne;
      setPlaybackTime(thisOffsetXZeroOne, state, playerElements).then(() => {
        updatePlayhead(state, timelineState, sharedState, playerElements);
      });
    });
};

const dragLocalPlayhead = (
  xZeroOne,
  state,
  timelineState,
  sharedState,
  playerElements
) => {
    const range = timelineState.right - timelineState.left;
    const thisOffsetXZeroOne = Math.min(
      timelineState.right,
      timelineState.left +
        Math.max(
          0,
          Math.min(range * xZeroOne, 1)
        )
    );
    cancelAnimationFrame(state.dragPlayheadRaf);
    if (state.audioContext.state !== "running") {
      // Update the playhead anyway.
      state.audioProgressZeroOne = thisOffsetXZeroOne;
      updatePlayhead(state, timelineState, sharedState, playerElements);
    }
    state.dragPlayheadRaf = requestAnimationFrame(async () => {
      state.audioProgressZeroOne = thisOffsetXZeroOne;
      //state.progressSampleTime = performance.now();
      setPlaybackTime(thisOffsetXZeroOne, state, playerElements).then(() => {
        updatePlayhead(state, timelineState, sharedState, playerElements);
      });
    });
};

const setPlaybackTime = async (offsetZeroOne, state) => {
  if (state.audioDuration) {
    if (state.audioContext.state !== "running") {
      await state.audioContext.resume();
    }
    state.audioProgressZeroOne = offsetZeroOne;
    state.playbackStartTime = performance.now();
    state.playbackStartOffset = offsetZeroOne;
  }
};

export const initAudio = (playerElements, audioFloatData, state) => {
  state.audioDuration = audioFloatData.length / 48000;
  const buffer = state.audioContext.createBuffer(1, audioFloatData.length, 48000);
  buffer.copyToChannel(audioFloatData, 0);
  state.audioBuffer = buffer;
};

const playAudio = async (state, timelineState, sharedState, playerElements, startAtOffsetZeroOne, stopAtOffsetZeroOne) => {
  if (state.playing) {
    pauseAudio(state, timelineState, sharedState, playerElements);
  }

  if (state.audioContext.state !== "running") {
    await state.audioContext.resume();
  }
  if (startAtOffsetZeroOne !== undefined) {
    state.audioProgressZeroOne = startAtOffsetZeroOne;
  }
  state.audioNodes.bufferNode = state.audioContext.createBufferSource();
  state.audioNodes.bufferNode.buffer = state.audioBuffer;
  state.audioNodes.bufferNode
    .connect(state.audioNodes.filterNode)
    .connect(state.audioNodes.gainNode)
    .connect(state.audioContext.destination);

  const startOffset = state.audioProgressZeroOne * state.audioDuration;

  const playbackLatency = state.audioContext.outputLatency || state.audioContext.baseLatency || 0;
  if (stopAtOffsetZeroOne !== undefined) {
    const endOffset = stopAtOffsetZeroOne * state.audioDuration;
    const secondsToPlay = endOffset - startOffset;

    state.endOffsetZeroOne = stopAtOffsetZeroOne;
    state.startOffsetZeroOne = state.audioProgressZeroOne;

    state.audioNodes.bufferNode.start(0, startOffset, secondsToPlay);
    state.playbackStartTime = performance.now() + playbackLatency;
    state.expectedPlaybackEnd = state.playbackStartTime + (secondsToPlay * 1000);
  } else {
    delete state.endOffsetZeroOne;
    state.audioNodes.bufferNode.start(0, startOffset);
    state.playbackStartTime = performance.now() + playbackLatency;
    state.expectedPlaybackEnd = state.playbackStartTime + (state.audioDuration * 1000);
  }
  state.playing = true;
  state.playbackStartOffset = state.audioProgressZeroOne;

  playerElements.playButton.classList.remove("paused");
  updatePlayhead(state, timelineState, sharedState, playerElements);
  state.root.dispatchEvent(
    new Event("playback-started", {
      bubbles: false,
      composed: true,
      cancelable: false,
    })
  );
};
const pauseAudio = (state, timelineState, sharedState, playerElements) => {
  if (state.playing) {
    cancelAnimationFrame(state.audioStatusPoll);
    state.audioStatusPoll = 0;
    state.playing = false;
    state.audioNodes.bufferNode.stop();
    playerElements.playButton.classList.add("paused");
    state.root.dispatchEvent(
      new Event("playback-ended", {
        bubbles: false,
        composed: true,
        cancelable: false,
      })
    );
  }
};

const updatePlayhead = (
  state,
  timelineState,
  sharedState,
  playerElements,
  beganPlaying = false,
  rangeChange = false,
) => {
  const {
    playheadCanvasCtx,
    mainPlayheadCanvasCtx,
  } = playerElements;
  const lastProgress = state.audioProgressZeroOne;
  const elapsedSincePlaybackStarted = state.playing ? (performance.now() - (state.playbackStartTime || performance.now())) / 1000 : 0;
  if (state.playing) {
    state.audioProgressZeroOne = Math.max(0, Math.min(1, ((state.playbackStartOffset * state.audioDuration) + elapsedSincePlaybackStarted) / state.audioDuration));
  }
  if (state.playing && (state.audioProgressZeroOne === 1 || performance.now() > state.expectedPlaybackEnd)) {
    pauseAudio(state, timelineState, sharedState, playerElements, 1);
    if (state.endOffsetZeroOne !== undefined) {
      state.audioProgressZeroOne = state.endOffsetZeroOne;
    } else {
      // Make sure we don't overshoot
      state.audioProgressZeroOne = lastProgress;
    }
  }
  const playheadWidth = Math.min(2, 1.5);
  const progress = state.audioProgressZeroOne;
  playheadCanvasCtx.clearRect(0, 0, playheadCanvasCtx.canvas.width, playheadCanvasCtx.canvas.height);
  mainPlayheadCanvasCtx.clearRect(0, 0, mainPlayheadCanvasCtx.canvas.width, mainPlayheadCanvasCtx.canvas.height);
  if (!Number.isNaN(progress)) {
    if (!rangeChange) {
      // Redraw the minimap playhead on its canvas at the correct offset position.
      const width = playheadCanvasCtx.canvas.width;
      const height = playheadCanvasCtx.canvas.height;
      playheadCanvasCtx.fillStyle = timelineState.isDarkTheme ? `rgba(204, 204, 204, 0.8)` : `rgba(0, 0, 0, 0.8)`;

      // Draw the global playhead position
      const left = Math.min(width - playheadWidth - 1, Math.max(-playheadWidth / 2, progress * width - playheadWidth/2));
      playheadCanvasCtx.fillRect(left, 0, playheadWidth, height);
    }
    {
      const fourPx = 4 * devicePixelRatio;
      const threePx = 3 * devicePixelRatio;
      const tenPx = 10 * devicePixelRatio;
      const width = mainPlayheadCanvasCtx.canvas.width;
      const height = mainPlayheadCanvasCtx.canvas.height;
      mainPlayheadCanvasCtx.clearRect(0, 0, width, height);
      mainPlayheadCanvasCtx.fillStyle = timelineState.isDarkTheme ? `rgba(204, 204, 204, 1)` : `rgba(0, 0, 0, 1)`;
      const drawPlayheadScrubHandles = (opacity) => {
        const audioProgressZeroOne = progress;
        const ctx = mainPlayheadCanvasCtx;
        const startZeroOne = timelineState.left;
        const endZeroOne = timelineState.right;
        const height = ctx.canvas.height;
        const center = Math.min(audioProgressZeroOne * width, width - 1);
        ctx.beginPath();
        ctx.moveTo(center, height);
        ctx.lineTo(center - fourPx, height - threePx);
        ctx.lineTo(center - fourPx, height - tenPx);
        ctx.lineTo(center + fourPx, height - tenPx);
        ctx.lineTo(center + fourPx, height - threePx);
        ctx.lineTo(center, height);
        ctx.fill();
        ctx.beginPath();
        // TODO: Use timelineState.inGlobalPlaybackScrubberHandle and timelineState.inLocalPlaybackScrubberHandle
        //  to show down/hover states for scrubber handles.
        if (timelineState.isDarkTheme) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
          ctx.moveTo(center, height);
          ctx.lineTo(center - fourPx, height - threePx);
          ctx.lineTo(center - fourPx, height - tenPx);
          ctx.lineTo(center, height - tenPx);
          ctx.lineTo(center, height);
          ctx.fill();
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
          ctx.moveTo(center, height);
          ctx.lineTo(center + fourPx, height - threePx);
          ctx.lineTo(center + fourPx, height - tenPx);
          ctx.lineTo(center, height - tenPx);
          ctx.lineTo(center, height);
          ctx.fill();
        }

        {
          ctx.fillStyle = timelineState.isDarkTheme ? `rgba(204, 204, 204, ${opacity})` : `rgba(0, 0, 0, ${opacity})`;
          const localProgress = (audioProgressZeroOne - startZeroOne) / (endZeroOne - startZeroOne);
          const center = localProgress * width;
          const height = tenPx + 0.5;
          ctx.beginPath();
          ctx.moveTo(center, height);
          ctx.lineTo(center - fourPx, height - threePx);
          ctx.lineTo(center - fourPx, height - tenPx);
          ctx.lineTo(center + fourPx, height - tenPx);
          ctx.lineTo(center + fourPx, height - threePx);
          ctx.lineTo(center, height);
          ctx.fill();
          ctx.beginPath();
          if (timelineState.isDarkTheme) {
            ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(opacity, 0.15)})`;
            ctx.moveTo(center, height);
            ctx.lineTo(center - fourPx, height - threePx);
            ctx.lineTo(center - fourPx, height - tenPx);
            ctx.lineTo(center, height - tenPx);
            ctx.lineTo(center, height);
            ctx.fill();
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(opacity, 0.25)})`;
            ctx.moveTo(center, height);
            ctx.lineTo(center + fourPx, height - threePx);
            ctx.lineTo(center + fourPx, height - tenPx);
            ctx.lineTo(center, height - tenPx);
            ctx.lineTo(center, height);
            ctx.fill();
          }
        }
      }

      const playheadInRange =
        progress >= timelineState.left && progress <= timelineState.right;

      if (state.playing) {
        state.audioStatusPoll = requestAnimationFrame(() => {
          updatePlayhead(state, timelineState, sharedState, playerElements);
        });
      }
      state.root.dispatchEvent(
        new CustomEvent("playhead-update", {
          bubbles: false,
          composed: true,
          cancelable: false,
          detail: {
            timeInSeconds: (progress * state.audioDuration)
          }
        })
      );
      const range = timelineState.right - timelineState.left;
      let opacity = 1;
      if (range >= 0.75) {
        opacity = mapRange(range, 0.75, 1, 1, 0.1);
      }
      if (playheadInRange) {
        drawPlayheadScrubHandles(opacity);
        mainPlayheadCanvasCtx.fillStyle = timelineState.isDarkTheme ? `rgba(204, 204, 204, ${opacity})` : `rgba(0, 0, 0, ${opacity})`;
        // Draw the local (zoomed area) playhead position
        const pro = (progress - timelineState.left) / range;
        const left = Math.max(0, Math.min(width - playheadWidth, pro * width - playheadWidth / 2));
        state.followPlayhead = true;
        mainPlayheadCanvasCtx.fillRect(left, tenPx + 0.5, playheadWidth, height);
        // NOTE: Advance range if playhead was inside range when playback started.
      } else if (state.followPlayhead && !sharedState.interacting) {
        const range = timelineState.right - timelineState.left;
        timelineState.right = Math.min(1, timelineState.right + range);
        timelineState.left = timelineState.right - range;
        drawPlayheadScrubHandles();

        playerElements.overlayCanvas.dispatchEvent(
          new CustomEvent("range-change", {
            detail: {
              startZeroOne: timelineState.left,
              endZeroOne: timelineState.right,
            },
          })
        );
      } else {
        drawPlayheadScrubHandles(opacity);
        state.followPlayhead = false;
      }
    }
  }
};

const togglePlayback = async (state, timelineState, sharedState, playerElements) => {
  if (!state.playing) {
    await playAudio(state, timelineState, sharedState, playerElements);
  } else {
    pauseAudio(state, timelineState, sharedState, playerElements);
  }
  return state.playing;
};
