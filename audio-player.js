export const initAudioPlayer = (
  sharedState,
  timelineState,
  playerElements,
) => {
  const audioContext = new AudioContext({ sampleRate: 48000 });
  const gainNode = audioContext.createGain();
  const filterNode = audioContext.createBiquadFilter();
  filterNode.type = "allpass";
  const mediaNode = audioContext.createMediaElementSource(playerElements.audio);
  playerElements.audio.addEventListener("canplay", () => {
    mediaNode
      .connect(filterNode)
      .connect(gainNode)
      .connect(audioContext.destination);
  });
  const volume = localStorage.getItem("spectastiq-volume") || 1.0;
  setGain(gainNode, volume);

  const state = {
    audioContext,
    audioProgressZeroOne: 0,
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
    resolver: () => {},
    resolved: false,
  };

  playerElements.playButton.addEventListener("click", () =>
    togglePlayback(state, timelineState, sharedState, playerElements)
  );
  playerElements.audio.addEventListener("timeupdate", () => {
    state.audioProgressZeroOne =
      playerElements.audio.currentTime / state.audioDuration;
    state.progressSampleTime = performance.now();
  });
  playerElements.audio.addEventListener("ended", () => {
    state.playing = false;
    pauseAudio(state, playerElements);
  });
  playerElements.audio.addEventListener("progress", () => {
    if (!state.resolved) {
      state.resolved = true;
      state.resolver();
    }
  });
  playerElements.audio.addEventListener("canplaythrough", () => {
    if (!state.resolved) {
      state.resolved = true;
      state.resolver();
    }
  });

  return {
    audioState: state,
    updatePlayhead: (beganPlaying = false, rangeChange = false, forced = false) =>
      updatePlayhead(
        state,
        timelineState,
        sharedState,
        playerElements,
        beganPlaying,
        rangeChange,
        forced
      ),
    setPlaybackOffset: (offsetZeroOne) =>
      setPlaybackTime(offsetZeroOne, state, playerElements),
    setBandPass: (minFreq, maxFreq) =>
      setBandPass(filterNode, minFreq, maxFreq),
    removeBandPass: () => removeBandPass(filterNode),
    setGain: (volume) => setGain(gainNode, volume),
    pause: () => pauseAudio(state, playerElements),
    play: () => playAudio(state, playerElements),
    togglePlayback: () => togglePlayback(state, timelineState, sharedState, playerElements),
    startPlayheadDrag: () => startPlayheadDrag(state, playerElements),
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
  biQuadFilterNode.type = "bandpass";
  const freqCenter = Math.sqrt(maxFreq * minFreq);
  const freqDelta = maxFreq - minFreq;
  biQuadFilterNode.frequency.value = freqCenter;
  biQuadFilterNode.Q.value = freqCenter / freqDelta;
};

const setGain = (gainNode, volume) => {
  gainNode.gain.value = volume;
  localStorage.setItem("spectastiq-volume", volume);
  return gainNode.gain.value;
};

const startPlayheadDrag = (state, playerElements) => {
    state.wasPlaying = state.playing;
    if (state.playing) {
      pauseAudio(state, playerElements);
    }
};

const endPlayheadDrag = (
  state,
  timelineState,
  sharedState,
  playerElements
) => {
  if (state.wasPlaying) {
    playAudio(state, timelineState, sharedState, playerElements);
  }
};


const dragGlobalPlayhead = (xZeroOne, state, timelineState, sharedState, playerElements) => {
    const thisOffsetXZeroOne = Math.max(
      0,
      Math.min(xZeroOne, 1)
    );
    cancelAnimationFrame(state.dragPlayheadRaf);
    state.dragPlayheadRaf = requestAnimationFrame(async () => {
      state.audioProgressZeroOne = thisOffsetXZeroOne;
      state.progressSampleTime = performance.now();
      updatePlayhead(state, timelineState, sharedState, playerElements);
      setPlaybackTime(thisOffsetXZeroOne, state, playerElements);
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
    state.dragPlayheadRaf = requestAnimationFrame(async () => {
      state.audioProgressZeroOne = thisOffsetXZeroOne;
      state.progressSampleTime = performance.now();
      updatePlayhead(state, timelineState, sharedState, playerElements);
      setPlaybackTime(thisOffsetXZeroOne, state, playerElements);
    });
};

const setPlaybackTime = (offsetZeroOne, state, playerElements) => {
  if (state.audioDuration) {
    playerElements.audio.currentTime = offsetZeroOne * state.audioDuration;
  }
};

export const initAudio = async (playerElements, audioFileUrl, state, audioDuration) => {
  state.audioDuration = audioDuration;
  if (
    playerElements.audio.currentTime !== undefined &&
    state.audioDuration !== undefined
  ) {
    state.audioProgressZeroOne =
      playerElements.audio.currentTime / state.audioDuration;
    state.progressSampleTime = performance.now();
  }
  state.resolved = false;
  return new Promise((resolve) => {
    if (playerElements.audio.src) {
      URL.revokeObjectURL(playerElements.audio.src);
    }
    state.resolver = resolve;
    playerElements.audio.src = audioFileUrl;
  });
};

const playAudio = (state, timelineState, sharedState, playerElements) => {
  state.playing = true;
  state.audioContext.resume();
  playerElements.audio.play();
  state.progressSampleTime = performance.now();
  playerElements.playButton.classList.remove("paused");
  updatePlayhead(state, timelineState, sharedState, playerElements, true);
};
const pauseAudio = (state, { playButton, audio }) => {
  cancelAnimationFrame(state.audioStatusPoll);
  state.playing = false;
  audio.pause();
  playButton.classList.add("paused");
};

const updatePlayhead = (
  state,
  timelineState,
  sharedState,
  playerElements,
  beganPlaying = false,
  rangeChange = false,
  forced = false
) => {
  const {
    playheadCanvasCtx,
    mainPlayheadCanvasCtx,
  } = playerElements;

  const now = performance.now();
  const timeSinceSamplingSeconds = (now - state.progressSampleTime) / 1000;
  const progress = forced ? state.audioProgressZeroOne / state.audioDuration :
    state.audioProgressZeroOne + timeSinceSamplingSeconds / state.audioDuration;
  playheadCanvasCtx.clearRect(0, 0, playheadCanvasCtx.canvas.width, playheadCanvasCtx.canvas.height);
  mainPlayheadCanvasCtx.clearRect(0, 0, mainPlayheadCanvasCtx.canvas.width, mainPlayheadCanvasCtx.canvas.height);
  if (!Number.isNaN(progress)) {
    if (!rangeChange) {
      // Redraw the minimap playhead on its canvas at the correct offset position.
      const width = playheadCanvasCtx.canvas.width;
      const height = playheadCanvasCtx.canvas.height;
      playheadCanvasCtx.fillStyle = timelineState.isDarkTheme ? "white" : "black";
      const left = progress * width - devicePixelRatio;
      playheadCanvasCtx.fillRect(left, 0, 2 * devicePixelRatio, height);
    }
    {
      const sevenPx = 7 * devicePixelRatio;
      const width = mainPlayheadCanvasCtx.canvas.width;
      const height = mainPlayheadCanvasCtx.canvas.height;
      mainPlayheadCanvasCtx.clearRect(0, 0, width, height);
      mainPlayheadCanvasCtx.fillStyle = timelineState.isDarkTheme ? "white" : "black";
      const drawScrubHandles = () => {
        const audioProgressZeroOne = progress;
        const ctx = mainPlayheadCanvasCtx;
        const startZeroOne = timelineState.left;
        const endZeroOne = timelineState.right;
        const height = ctx.canvas.height;
        const center = audioProgressZeroOne * width;
        ctx.beginPath();
        ctx.moveTo(center, height);
        ctx.lineTo(center - sevenPx, height - sevenPx * 3);
        ctx.lineTo(center + sevenPx, height - sevenPx * 3);
        ctx.lineTo(center, height);
        ctx.fill();

        if (audioProgressZeroOne >= startZeroOne && audioProgressZeroOne <= endZeroOne) {
          const localProgress = (audioProgressZeroOne - startZeroOne) / (endZeroOne - startZeroOne);
          const center = localProgress * width;
          ctx.beginPath();
          ctx.moveTo(center, sevenPx * 3);
          ctx.lineTo(center - sevenPx, 1);
          ctx.lineTo(center + sevenPx, 1);
          ctx.lineTo(center, sevenPx * 3);
          ctx.fill();
        }
      }

      const playheadInRange =
        progress >= timelineState.left && progress <= timelineState.right;

      if (state.playing) {
        state.audioStatusPoll = requestAnimationFrame(() => {
          updatePlayhead(state, timelineState, sharedState, playerElements);
        });
      }
      playerElements.overlayCanvas.dispatchEvent(
        new CustomEvent("playhead-update", {
          bubbles: true,
          composed: true,
          detail: {
            timeInSeconds: (progress * state.audioDuration),
            totalDurationInSeconds: state.audioDuration
          }
        })
      );

      if (playheadInRange) {
        const range = timelineState.right - timelineState.left;
        const pro = (progress - timelineState.left) / range;
        const left = pro * width - devicePixelRatio;
        state.followPlayhead = true;
        mainPlayheadCanvasCtx.fillRect(left, (sevenPx * 3) - 2, 2 * devicePixelRatio, height);
        drawScrubHandles();
        // NOTE: Advance range if playhead was inside range when playback started.
      } else if (state.followPlayhead && !sharedState.interacting) {
        const range = timelineState.right - timelineState.left;
        timelineState.right = Math.min(1, timelineState.right + range);
        timelineState.left = timelineState.right - range;
        drawScrubHandles();

        playerElements.overlayCanvas.dispatchEvent(
          new CustomEvent("range-change", {
            detail: {
              startZeroOne: timelineState.left,
              endZeroOne: timelineState.right,
            },
          })
        );
      } else {
        drawScrubHandles();
        state.followPlayhead = false;
      }
    }
  }
};

const togglePlayback = (state, timelineState, sharedState, playerElements) => {
  if (!state.playing) {
    playAudio(state, timelineState, sharedState, playerElements);
  } else {
    pauseAudio(state, playerElements);
  }
  return state.playing;
};
