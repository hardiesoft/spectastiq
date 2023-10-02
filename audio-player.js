

export const initAudioPlayer = (sharedState, timelineState, playerElements, audioFileBytes) => {
  const state = {
    audioProgressZeroOne: 0,
    progressSampleTime: 0,
    playing: false,
    audioStatusPoll: 0,
    capturedElement: null,
    wasPlaying: false,
    playheadStartOffsetXZeroOne: 0,
    playheadDragOffsetX: 0,
    // prevLeft: 0,
    // prevRight: 1,
    followPlayhead: false,
    mainPlayheadStartOffsetXZeroOne: 0,
    mainPlayheadDragOffsetX: 0,
    dragPlayheadRaf: 0,
    playheadWasInRangeWhenPlaybackStarted: false
  };

  playerElements.playheadScrubber.addEventListener("pointerdown", (e) => startPlayheadDrag(e, state, playerElements));
  playerElements.playheadScrubber.addEventListener("pointermove", (e) => dragPlayhead(e, state, timelineState, sharedState, playerElements));
  playerElements.playheadScrubber.addEventListener("pointerup", (e) => endPlayheadDrag(e, state, timelineState, sharedState, playerElements));

  playerElements.mainPlayheadScrubber.addEventListener("pointerdown", (e) => startMainPlayheadDrag(e, state, playerElements));
  playerElements.mainPlayheadScrubber.addEventListener("pointermove", (e) => dragMainPlayhead(e, state, timelineState, sharedState, playerElements));
  playerElements.mainPlayheadScrubber.addEventListener("pointerup", (e) => endMainPlayheadDrag(e, state, timelineState, sharedState, playerElements));

  playerElements.playButton.addEventListener("click", () => togglePlayback(state, timelineState, sharedState, playerElements));


  return { audioState: state, updatePlayhead };
};
const startPlayheadDrag = (e, state, playerElements) => {
  if (e.isPrimary && !state.capturedElement) {
    playerElements.playheadScrubber.setPointerCapture(e.pointerId);
    state.wasPlaying = state.playing;
    if (state.playing) {
      pauseAudio(state, playerElements);
    }
    state.capturedElement = playerElements.playheadScrubber;
    const pBounds = playerElements.playheadScrubber.parentElement.getBoundingClientRect();
    const hBounds = playerElements.playheadScrubber.getBoundingClientRect();
    state.playheadStartOffsetXZeroOne = (hBounds.left - pBounds.left) / pBounds.width;
    state.playheadDragOffsetX = (e.clientX - pBounds.left) / pBounds.width;
    //handleGrabXZeroOne = e.offsetX / hBounds.width;
    playerElements.canvas.dispatchEvent(new Event("interaction-begin"));
  }
};



const startMainPlayheadDrag = (e, state, playerElements) => {
  if (e.isPrimary && !state.capturedElement) {
    playerElements.mainPlayheadScrubber.setPointerCapture(e.pointerId);
    playerElements.mainPlayheadScrubber.classList.add("grabbing");
    state.wasPlaying = state.playing;
    if (state.playing) {
      pauseAudio(state, playerElements);
    }
    state.capturedElement = playerElements.mainPlayheadScrubber;
    const pBounds = playerElements.mainPlayheadScrubber.parentElement.parentElement.getBoundingClientRect();
    const hBounds = playerElements.mainPlayheadScrubber.getBoundingClientRect();
    state.mainPlayheadStartOffsetXZeroOne = state.prevLeft + (hBounds.left - pBounds.left) / pBounds.width;
    state.mainPlayheadDragOffsetX = (e.clientX - hBounds.left) / hBounds.width;
    playerElements.canvas.dispatchEvent(new Event("interaction-begin"));
  }
};

const endPlayheadDrag = (e, state, timelineState, sharedState, playerElements) => {
  if (e.isPrimary) {
    playerElements.playheadScrubber.releasePointerCapture(e.pointerId);
    if (state.wasPlaying) {
      playAudio(state, timelineState, sharedState, playerElements);
    }
    state.capturedElement = null;
    playerElements.canvas.dispatchEvent(new Event("interaction-end"));
  }
};

const endMainPlayheadDrag = (e, state, timelineState, sharedState, playerElements) => {
  if (e.isPrimary) {
    playerElements.mainPlayheadScrubber.releasePointerCapture(e.pointerId);
    playerElements.mainPlayheadScrubber.classList.remove("grabbing");
    if (state.wasPlaying) {
      playAudio(state, timelineState, sharedState, playerElements);
    }
    state.capturedElement = null;
    playerElements.canvas.dispatchEvent(new Event("interaction-end"));
  }
};



const dragPlayhead = (e, state, timelineState, sharedState, playerElements) => {
  if (e.isPrimary && e.target.hasPointerCapture(e.pointerId) && state.capturedElement === playerElements.playheadScrubber) {
    const pBounds = playerElements.playheadScrubber.parentElement.parentElement.getBoundingClientRect();

    const thisOffsetXZeroOne = Math.max(0, Math.min((e.clientX - pBounds.left) / pBounds.width, 1));
    cancelAnimationFrame(state.dragPlayheadRaf);
    state.dragPlayheadRaf = requestAnimationFrame(async () => {
      state.audioProgressZeroOne = thisOffsetXZeroOne;
      state.progressSampleTime = performance.now();
      updatePlayhead(state, timelineState, sharedState, playerElements);
      if (playerElements.audio.duration) {
        playerElements.audio.currentTime = thisOffsetXZeroOne * playerElements.audio.duration;
      }
    });
  }
};

const dragMainPlayhead = (e, state, timelineState, sharedState, playerElements) => {
  const { mainPlayheadScrubber, audio } = playerElements;
  if (e.isPrimary && e.target.hasPointerCapture(e.pointerId) && state.capturedElement === mainPlayheadScrubber) {
    const pBounds = mainPlayheadScrubber.parentElement.parentElement.getBoundingClientRect();
    const range = timelineState.right - timelineState.left;
    const thisOffsetXZeroOne = Math.min(timelineState.right, timelineState.left + Math.max(0, Math.min(range * ((e.clientX - pBounds.left) / pBounds.width), 1)));
    cancelAnimationFrame(state.dragPlayheadRaf);
    state.dragPlayheadRaf = requestAnimationFrame(async () => {
      state.audioProgressZeroOne = thisOffsetXZeroOne;
      state.progressSampleTime = performance.now();
      updatePlayhead(state, timelineState, sharedState, playerElements);
      if (audio.duration) {

        audio.currentTime = thisOffsetXZeroOne * audio.duration;
      }
    });
  }
};

export const initAudio = async (playheadElements, audioFileUrl, state) => {

  return new Promise((resolve) => {
    if (!playheadElements.audio.src) {
      playheadElements.audio.addEventListener("progress", () => {
        state.audioDuration = playheadElements.audio.duration;
        resolve();
        // const ranges = audio.seekable;
        // console.log(ranges.start(0), ranges.end(0));
        //console.log(duration);
        // The duration variable now holds the duration (in seconds) of the audio clip
      });
      playheadElements.audio.addEventListener("timeupdate", () => {
        state.audioProgressZeroOne = playheadElements.audio.currentTime / playheadElements.audio.duration;
        state.progressSampleTime = performance.now();
        //renderAudioPlayhead(audioProgressZeroOne);
        // The duration variable now holds the duration (in seconds) of the audio clip
      });
      playheadElements.audio.addEventListener("ended", () => {
        state.playing = false;
        pauseAudio(state, playheadElements);
        // The duration variable now holds the duration (in seconds) of the audio clip
      });
      playheadElements.audio.src = audioFileUrl;
      // TODO: window.URL.revokeObjectURL(url); When unloading

      // audio.addEventListener("loadedmetadata", () => {
      //   let duration = audio.duration;
      //   console.log(duration);
      //   // The duration variable now holds the duration (in seconds) of the audio clip
      // });

    }
    if (playheadElements.audio.currentTime !== undefined && playheadElements.audio.duration !== undefined) {
      state.audioProgressZeroOne = playheadElements.audio.currentTime / playheadElements.audio.duration;
      state.progressSampleTime = performance.now();
    }
  });
};

const playAudio = (state, timelineState, sharedState, playerElements) => {
  state.playing = true;
  playerElements.audio.play();
  state.progressSampleTime = performance.now();
  playerElements.playButton.classList.remove("paused");
  updatePlayhead(state, timelineState, sharedState, playerElements, true);
};
const pauseAudio = (state, {playButton, audio}) => {
  cancelAnimationFrame(state.audioStatusPoll);
  state.playing = false;
  audio.pause();
  playButton.classList.add("paused");
};

const positionPlayhead = (progressZeroOne, playheadScrubber) => {
  const pBounds = playheadScrubber.parentElement.parentElement.getBoundingClientRect();
  playheadScrubber.parentElement.style.transform = `translateX(${progressZeroOne * pBounds.width}px)`;
};

export const updatePlayhead = (state, timelineState, sharedState, playerElements, beganPlaying = false, rangeChange = false) => {

  const {playheadCanvasCtx, mainPlayheadCanvasCtx, mainPlayheadScrubber} = playerElements;

  const now = performance.now();
  const timeSinceSamplingSeconds = (now - state.progressSampleTime) / 1000;
  const progress = state.audioProgressZeroOne + (timeSinceSamplingSeconds / state.audioDuration);
  if (!Number.isNaN(progress)) {
    //positionPlayhead(progress, playheadScrubber);
    if (!rangeChange) {
      const width = playheadCanvasCtx.canvas.width;
      const height = playheadCanvasCtx.canvas.height;
      playheadCanvasCtx.clearRect(0, 0, width, height);
      playheadCanvasCtx.fillStyle = "white";
      const left = (progress * width) - (devicePixelRatio);
      playheadCanvasCtx.fillRect(left, 0, 2 * devicePixelRatio, height);
    }
    {
      const width = mainPlayheadCanvasCtx.canvas.width;
      const height = mainPlayheadCanvasCtx.canvas.height;
      mainPlayheadCanvasCtx.clearRect(0, 0, width, height);
      mainPlayheadCanvasCtx.fillStyle = "white";
      const playheadInRange = progress >= timelineState.left && progress <= timelineState.right;
      if (playheadInRange) {
        const range = timelineState.right - timelineState.left;
        const pro = (progress - timelineState.left) / range;
        const left = (pro * width) - (devicePixelRatio);
        state.followPlayhead = true;
        //console.log(mainPlayheadCanvasCtx, mainPlayheadScrubber);
        mainPlayheadCanvasCtx.fillRect(left, 0, 2 * devicePixelRatio, height);
        // NOTE: Advance range if playhead was inside range when playback started.
        const pBounds = mainPlayheadScrubber.parentElement.parentElement.getBoundingClientRect();
        mainPlayheadScrubber.parentElement.style.display = `block`;
        mainPlayheadScrubber.parentElement.style.transform = `translateX(${pro * pBounds.width}px)`;
      } else if (state.followPlayhead && !sharedState.interacting) {
        const range = timelineState.right - timelineState.left;
        timelineState.right = Math.min(1, timelineState.right + range);
        timelineState.left = timelineState.right - range;
        playerElements.canvas.dispatchEvent(new CustomEvent("range-change", {
          detail: {
            startZeroOne: timelineState.left,
            endZeroOne: timelineState.right,
          }
        }));
      } else {
        state.followPlayhead = false;
        mainPlayheadScrubber.parentElement.style.display = `none`;
      }
      // if (beganPlaying) {
      //   state.playheadWasInRangeWhenPlaybackStarted = playheadInRange;
      // }
      if (!playheadInRange && state.playheadWasInRangeWhenPlaybackStarted) {
        // Advance timeline to keep playhead in view.

      }
    }
  } else {
    mainPlayheadScrubber.parentElement.style.display = `none`;
  }
  if (state.playing) {
    state.audioStatusPoll = requestAnimationFrame(() => {
      updatePlayhead(state, timelineState, sharedState, playerElements);
    });
  }
};

const togglePlayback = (state, timelineState, sharedState, playerElements) => {
  // TODO: Handle events for seeked, seeking
  // Check seekable for timeranges that can bee seeked.  If we decoded the full wav, presumably we can seek anywhere.
    if (!state.playing) {
      playAudio(state, timelineState, sharedState, playerElements);
    } else {
      pauseAudio(state, playerElements);
    }
};
