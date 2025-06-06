import {mapRange} from "./webgl-drawimage.js";

const getMaxXZoom = (canvasWidth, state) => {
  const audioSamples = state.numAudioSamples;
  if (audioSamples) {
    // About 180 samples per pixel looks about max res at FFT size of 2048
    return (audioSamples / canvasWidth / 180) * window.devicePixelRatio;
  } else {
    return 16;
  }
};

const getMaxYZoom = (canvasHeight) => {
  const FFT_WINDOW_SIZE = 2048;
  const frequencyResolution = FFT_WINDOW_SIZE / 2;
  // About 180 samples per pixel looks about max res at FFT size of 2048
  //return frequencyResolution / canvasHeight; // * window.devicePixelRatio;


  // FIXME: Should this be * 0.8?  Maybe it's being clamped elsewhere?
  return (frequencyResolution / (canvasHeight / window.devicePixelRatio));

};

const setInitialZoom = (
  left,
  right,
  top,
  bottom,
  state,
  sharedState,
  timelineElements,
  initial,
  final
) => {
  // Update zoom level
  const zoomXLength = right - left;
  const zoomXToSet = 1 / zoomXLength;
  const zoomYLength = top - bottom;
  const zoomYToSet = 1 / zoomYLength;
  const maxXZoom = getMaxXZoom(timelineElements.canvas.width, state);
  const maxYZoom = getMaxYZoom(timelineElements.canvas.height);
  const newXZoom = Math.min(maxXZoom, zoomXToSet);
  const newYZoom = Math.min(maxYZoom, zoomYToSet);
  state.left = left;
  state.right = right;
  state.zoomX = newXZoom;
  state.top = top;
  state.bottom = bottom;
  state.zoomY = newYZoom;

  timelineElements.overlayCanvas.dispatchEvent(
    new CustomEvent("range-change", {
      detail: {
        startZeroOne: state.left,
        endZeroOne: state.right,
        top: state.top,
        bottom: state.bottom,
        initialRender: initial,
        force: final,
      },
    })
  );
};

const updateZoom = (
  pXRatio,
  zoomAmount,
  state,
  sharedState,
  timelineElements
) => {
  const initialLeft = state.left;
  const initialRight = state.right;
  // Save prev zoom level
  const visiblePortionI = 1 / state.zoomX;
  const invisiblePortionI = 1 - visiblePortionI; // How much offscreen to distribute.
  // Update zoom level
  state.zoomX += Math.min(1, zoomAmount);
  state.zoomX = Math.max(1, state.zoomX);
  state.zoomX = Math.min(
    getMaxXZoom(timelineElements.canvas.width, state),
    state.zoomX
  );
  if (state.zoomX === 1) {
    state.left = 0;
    state.right = 1;
  } else {
    // See how much zoom level has changed, and how much we have to distribute.
    const visiblePortion = 1 / state.zoomX;
    const invisiblePortion = 1 - visiblePortion; // How much offscreen to distribute.
    // Distribute proportionally on either side of pX the increase in width/zoom.
    const newWToDistribute = invisiblePortion - invisiblePortionI;
    const leftShouldTake = newWToDistribute * pXRatio;
    const rightShouldTake = newWToDistribute * (1 - pXRatio);
    const prevLeft = state.left;
    const prevRight = state.right;

    state.left += leftShouldTake;
    state.left = Math.max(0, state.left);
    // NOTE: Balance out if one side took less than it's fair share.
    const leftTook = state.left - prevLeft;

    state.right -= newWToDistribute * (1 - pXRatio);
    state.right -= Math.min(0, leftShouldTake - leftTook);
    state.right = Math.min(1, state.right);

    // NOTE: If right didn't take everything it could, redistribute to the left.
    const rightTook = prevRight - state.right;
    state.left += Math.min(0, rightShouldTake - rightTook);
  }

  if (!sharedState.interacting) {
    const changeLeft = Math.abs(initialLeft - state.left);
    const changeRight = Math.abs(initialRight - state.right);
    if (changeLeft !== 0 || changeRight !== 0) {
      timelineElements.overlayCanvas.dispatchEvent(
        new Event("interaction-begin")
      );
      clearTimeout(sharedState.interactionTimeout);
      sharedState.interactionTimeout = setTimeout(() => {
        timelineElements.overlayCanvas.dispatchEvent(
          new Event("interaction-end")
        );
      }, 300);
    }
  }

  timelineElements.overlayCanvas.dispatchEvent(
    new CustomEvent("range-change", {
      detail: {
        startZeroOne: state.left,
        endZeroOne: state.right,
        initialRender: false,
      },
    })
  );
};

const updatePinch = (
  xStartPxRatio,
  xEndPxRatio,
  initialXStartPxRatio,
  initialXEndPxRatio,
  state,
  canvas
) => {
  // Range between two points.  This should remain constant
  const initialRatio = initialXEndPxRatio - initialXStartPxRatio;
  const newRatio = xEndPxRatio - xStartPxRatio;
  const maxZoomX = getMaxXZoom(canvas.width, state);
  const zoomX = Math.min(newRatio / initialRatio, maxZoomX);
  const visiblePortionI = 1 / zoomX;
  let initialLeft = initialXStartPxRatio - xStartPxRatio / zoomX;
  let initialRight = initialLeft + visiblePortionI;
  const range = initialXEndPxRatio - initialXStartPxRatio;

  const maxOutOfBounds = range * 0.25;
  // If left or right is outside the 0..1 bounds, start to add resistance, proportional to how much over it is.
  if (initialLeft < 0) {
    const a = Math.max(-maxOutOfBounds, initialLeft);
    const b = Math.abs(a) / 2;
    const c = Math.sqrt(b) / 3;
    initialLeft = c * a;
    initialRight = initialLeft + visiblePortionI;
  } else if (initialRight > 1) {
    if (state.panStarted) {
      initialLeft = 1 - state.initialPanRange;
    } else if (state.pinchStarted) {
      initialLeft = initialRight - visiblePortionI;
    }
  }
  state.left = Math.max(0, initialLeft);
  state.right = Math.min(1, initialRight);
  canvas.dispatchEvent(
    new CustomEvent("range-change", {
      detail: {
        startZeroOne: state.left,
        endZeroOne: state.right,
        initialRender: false,
      },
    })
  );
};

const onPointerMove = (canvas, state, sharedState) => {
  const numPointers = Object.keys(state.pointers).length;
  if (numPointers <= 2) {
    const pointers = Object.values(state.pointers);
    const canvasWidth = canvas.width / devicePixelRatio;

    let pinchXLeftZeroOne;
    let pinchXRightZeroOne;
    if (numPointers === 2) {
      if (!state.panStarted || state.pinchStarted) {
        const x0 = pointers[0].x;
        const x1 = pointers[1].x;
        pinchXLeftZeroOne = Math.max(0, Math.min(x0, x1) / canvasWidth);
        pinchXRightZeroOne = Math.min(1, Math.max(x0, x1) / canvasWidth);
        if (!state.pinchStarted) {
          state.pinchStarted = true;
          if (!sharedState.interacting) {
            canvas.dispatchEvent(new Event("interaction-begin"));
          }
          const range = state.right - state.left;
          state.initialPinchXLeftZeroOne =
            state.left + range * pinchXLeftZeroOne;
          state.initialPinchXRightZeroOne =
            state.left + range * pinchXRightZeroOne;
        }
      } else {
        state.pinchStarted = false;
        state.panStarted = false;
      }
    } else if (numPointers === 1) {
      const scrubLocal = state.scrubLocalStarted;
      const scrubGlobal = state.scrubGlobalStarted;
      const isScrubbing = scrubGlobal || scrubLocal;
      if (!state.pinchStarted) {
        let range = state.right - state.left;
        if (state.panStarted) {
          range = state.initialPanRange;
        }
        const x0 = pointers[0].x / canvasWidth;
        pinchXLeftZeroOne = Math.max(0, x0);
        pinchXRightZeroOne = pinchXLeftZeroOne + range;
        if (
          !state.pinchStarted &&
          !state.panStarted &&
          !state.scrubGlobalStarted &&
          !state.scrubLocalStarted
        ) {
          state.panStarted = true;
          if (!sharedState.interacting) {
            canvas.dispatchEvent(new Event("interaction-begin"));
          }
          state.initialPinchXLeftZeroOne = Math.max(
            0,
            state.left + range * pinchXLeftZeroOne
          );
          state.initialPinchXRightZeroOne = Math.min(
            1,
            state.left + range * pinchXRightZeroOne
          );
          state.startPanXZeroOne = state.left;
          state.initialPanRange = state.right - state.left;
        } else if (isScrubbing) {
          if (!sharedState.interacting) {
            canvas.dispatchEvent(new Event("interaction-begin"));
          }
          const progress =
            (pointers[0].x - state.scrubDragOffsetX) / canvasWidth;
          if (scrubLocal) {
            state.dragLocalPlayhead(progress);
          } else if (scrubGlobal) {
            state.dragGlobalPlayhead(progress);
          }
        } else if (state.panStarted) {
          const localLeft = Math.max(
            0,
            state.startPanXZeroOne + range * pinchXLeftZeroOne
          );
          state.left = Math.min(
            1 - state.initialPanRange,
            Math.max(
              0,
              state.startPanXZeroOne -
              (localLeft - state.initialPinchXLeftZeroOne)
            )
          );
          state.right = state.left + state.initialPanRange;
          canvas.dispatchEvent(
            new CustomEvent("range-change", {
              detail: {
                startZeroOne: state.left,
                endZeroOne: state.right,
                initialRender: false,
              },
            })
          );
        }
      } else {
        state.pinchStarted = false;
        state.panStarted = false;
      }
    }
    if (
      (sharedState.interacting && state.pinchStarted && numPointers < 2) ||
      (state.panStarted && numPointers < 1)
    ) {
      canvas.dispatchEvent(new Event("interaction-end"));
    }
    // TODO: We may want to allow pinching in to less than 100%, and then bounce back out.
    if (state.pinchStarted) {
      updatePinch(
        pinchXLeftZeroOne,
        pinchXRightZeroOne,
        state.initialPinchXLeftZeroOne,
        state.initialPinchXRightZeroOne,
        state,
        canvas
      );
    }
  }
};

const startHandleDrag = (e, timelineElements, timelineState, xOffset) => {
  if (e.isPrimary && !timelineState.currentAction) {
    const handle = timelineElements.timelineUICanvas;
    handle.setPointerCapture(e.pointerId);
    timelineState.currentAction = "pan";
    if (e.pressure > 0 && e.pointerType !== "touch") {
      if (!handle.classList.contains("grabbing")) {
        handle.classList.add("grabbing");
      }
    }
    timelineState.handleStartOffsetXZeroOne = timelineState.left;
    timelineState.handleDragOffsetX = xOffset;
    timelineElements.overlayCanvas.dispatchEvent(
      new Event("interaction-begin")
    );
  }
};

const endHandleDrag = (e, timelineElements, state) => {
  if (e.isPrimary) {
    timelineElements.timelineUICanvas.releasePointerCapture(e.pointerId);
    if (e.pointerType !== "touch") {
      if (timelineElements.timelineUICanvas.classList.contains("grabbing")) {
        timelineElements.timelineUICanvas.classList.remove("grabbing", "grab");
      }
    }
    state.currentAction = null;
    timelineElements.overlayCanvas.dispatchEvent(new Event("interaction-end"));
  }
};

const dragHandle = (e, timelineElements, state, thisOffsetX) => {
  if (
    e.isPrimary &&
    e.target.hasPointerCapture(e.pointerId) &&
    state.currentAction === "pan"
  ) {
    const xOffset = state.handleDragOffsetX - state.handleStartOffsetXZeroOne;
    const range = state.right - state.left;
    let initialLeft = state.left;
    let initialRight = state.right;
    state.left = thisOffsetX - xOffset;
    state.right = state.left + range;
    if (state.left < 0 || state.right > 1) {
      if (state.right > 1 && state.left > 0) {
        state.right = 1;
        state.left = state.right - range;
      } else if (state.left < 0 && state.right < 1) {
        state.left = 0;
        state.right = state.left + range;
      } else {
        state.left = initialLeft;
        state.right = initialRight;
      }
    }
    timelineElements.overlayCanvas.dispatchEvent(
      new CustomEvent("range-change", {
        detail: {
          startZeroOne: state.left,
          endZeroOne: state.right,
          initialRender: false,
        },
      })
    );
  } else {
    e.preventDefault();
  }
};

export const drawTimelineUI =
  (timelineElements, state) => (startZeroOne, endZeroOne, currentAction) => {
    // Draw handles on timelineUICanvas.
    const isDarkTheme = state.isDarkTheme;
    const ctx = timelineElements.timelineUICanvas.getContext("2d");
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const start = startZeroOne * width;
    const end = endZeroOne * width;
    const onePx = devicePixelRatio;
    const halfPx = 0.5 * devicePixelRatio;
    const twoPx = 2 * devicePixelRatio;
    const threePx = 3 * devicePixelRatio;
    const handleWidth = end - start - onePx;
    const minHandleWidth = 44 * devicePixelRatio;
    const handleIsNarrow = handleWidth < minHandleWidth;
    const unselectedHandleColor = isDarkTheme ? "#b1b2b5" : "#595959";
    const selectedHandleColor = isDarkTheme ? "#cccdd1" : "#333333";
    const resizeHandleAt = (x, color, cX) => {
      const y = height / 2 - handleHeight / 2;
      const halfWidth = resizeHandleWidth / 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      const atStart = x < halfWidth;

      const atEnd = x + resizeHandleWidth > width - halfWidth;
      if (atStart || atEnd) {
        if (atStart) {
          ctx.roundRect(x, y, resizeHandleWidth, handleHeight, [
            cX,
            halfWidth,
            halfWidth,
            cX,
          ]);
        } else {
          ctx.roundRect(x, y, resizeHandleWidth, handleHeight, [
            halfWidth,
            cX,
            cX,
            halfWidth,
          ]);
        }
        ctx.roundRect(x, y, resizeHandleWidth, handleHeight, halfWidth);
      } else {
        ctx.roundRect(x, y, resizeHandleWidth, handleHeight, halfWidth);
      }
      ctx.fill();
      ctx.fillStyle = isDarkTheme ? "#666" : "#ccc";
      ctx.beginPath();
      const circleX = x + halfWidth - 1.5 * devicePixelRatio;
      const circleC = 3 * devicePixelRatio;
      ctx.roundRect(
        circleX,
        y + 4.5 * devicePixelRatio,
        circleC,
        circleC,
        circleC * 0.5
      );
      ctx.roundRect(
        circleX,
        y + 10.5 * devicePixelRatio,
        circleC,
        circleC,
        circleC * 0.5
      );
      ctx.roundRect(
        circleX,
        y + 16.5 * devicePixelRatio,
        circleC,
        circleC,
        circleC * 0.5
      );
      ctx.fill();
    };

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle =
      currentAction !== null ? `rgba(0, 0, 0, 0.25)` : "rgba(0, 0, 0, 0.2)";
    ctx.beginPath();
    ctx.rect(0, 0, width, height);

    const vStep1 = height / 2;
    const vStep2 = (height / 4) * 3;

    const drawPanHandlePath = (handleIsNarrow, selected) => {
      if (!handleIsNarrow) {
        if (!selected) {
          ctx.roundRect(
            Math.max(halfPx, start),
            halfPx,
            handleWidth,
            height - onePx,
            threePx
          );
        } else {
          ctx.roundRect(
            start + onePx,
            onePx,
            handleWidth - onePx,
            height - twoPx,
            threePx
          );
        }
      } else {
        // Something fancy, a kind of funnel from the wide grabby bit of the handle to the width that shows how wide
        // the current selection range actually is.
        const left = Math.max(halfPx, start);
        const leftWideExtreme = Math.min(
          width - minHandleWidth - halfPx,
          Math.max(halfPx, left - minHandleWidth / 2 + handleWidth / 2)
        );
        const rightWideExtreme = leftWideExtreme + minHandleWidth; //(minHandleWidth / 2) - (handleWidth / 2);
        const top = halfPx;
        const bottom = height - onePx;

        ctx.moveTo(left, top);
        ctx.lineTo(left + handleWidth - threePx, halfPx);
        ctx.arcTo(
          left + handleWidth,
          halfPx,
          left + handleWidth,
          halfPx + threePx,
          threePx
        );
        ctx.bezierCurveTo(
          left + handleWidth,
          vStep2,
          rightWideExtreme,
          vStep1,
          rightWideExtreme,
          bottom - threePx
        );
        ctx.arcTo(
          rightWideExtreme,
          bottom,
          rightWideExtreme - threePx,
          bottom,
          threePx
        );
        ctx.lineTo(leftWideExtreme + threePx, bottom);
        ctx.arcTo(
          leftWideExtreme,
          bottom,
          leftWideExtreme,
          bottom - threePx,
          threePx
        );
        ctx.bezierCurveTo(
          leftWideExtreme,
          vStep1,
          left,
          vStep2,
          left,
          top + threePx
        );
        ctx.arcTo(left, top, left + threePx, top, threePx);
      }
    };

    // Draw track and pan handle cutout
    drawPanHandlePath(handleIsNarrow, false);
    ctx.fill("evenodd");

    // Stroke pan handle
    ctx.beginPath();
    if (currentAction === "pan") {
      ctx.strokeStyle = selectedHandleColor; //`rgba(${c}, ${c}, ${c}, 1)`;
      ctx.lineWidth = twoPx;
      drawPanHandlePath(handleIsNarrow, true);
    } else {
      ctx.strokeStyle = unselectedHandleColor; //`rgba(${c}, ${c}, ${c}, 0.75)`;
      ctx.lineWidth = onePx;
      drawPanHandlePath(handleIsNarrow, false);
    }
    ctx.stroke();

    // Draw resize handles
    const resizeHandleWidth = 8 * devicePixelRatio;
    const handleHeight = 24 * devicePixelRatio;
    const leftHandleColour =
      currentAction === "resize-left" || state.overLeftHandle
        ? selectedHandleColor
        : unselectedHandleColor;
    const rightHandleColour =
      currentAction === "resize-right" || state.overRightHandle
        ? selectedHandleColor
        : unselectedHandleColor;
    const halfWidth = resizeHandleWidth / 2;
    let leftX;
    const leftC = Math.min(
      halfWidth,
      halfWidth - Math.min(halfWidth, halfWidth - start)
    );
    let rightC = Math.min(
      halfWidth,
      halfWidth - Math.min(halfWidth, halfWidth - (width - end))
    );
    if (handleWidth > minHandleWidth * 2) {
      leftX = Math.max(0, start - resizeHandleWidth * 0.5);
    } else {
      leftX =
        Math.max(0, start - resizeHandleWidth * 0.5) +
        (handleWidth / 2 - minHandleWidth);
    }
    let rightX;
    if (handleWidth > minHandleWidth * 2) {
      rightX =
        Math.min(width - resizeHandleWidth, end - resizeHandleWidth * 0.5) -
        onePx;
    } else {
      rightX = Math.min(
        width - resizeHandleWidth,
        end - resizeHandleWidth * 0.5 - (handleWidth / 2 - minHandleWidth)
      );
    }
    // Draw left resize handle
    resizeHandleAt(leftX, leftHandleColour, leftC);
    // Draw right resize handle
    resizeHandleAt(rightX, rightHandleColour, rightC);
  };

const startHandleResize = (e, timelineElements, state, xOffset, action) => {
  if (e.isPrimary && !state.currentAction) {
    const target = e.target;
    target.setPointerCapture(e.pointerId);
    state.currentAction = action;
    if (action === "resize-left") {
      state.handleStartOffsetXZeroOne = state.left;
    } else if (action === "resize-right") {
      state.handleStartOffsetXZeroOne = state.right;
    }
    state.handleDragOffsetX = xOffset;
    timelineElements.overlayCanvas.dispatchEvent(
      new Event("interaction-begin")
    );
  }
};
const endHandleResize = (e, timelineElements, state) => {
  if (e.isPrimary) {
    const target = e.target;
    if (
      state.currentAction === "resize-left" ||
      state.currentAction === "resize-right"
    ) {
      target.releasePointerCapture(e.pointerId);
      state.currentAction = null;
      timelineElements.overlayCanvas.dispatchEvent(
        new Event("interaction-end")
      );
    }
  }
};
const dragResize = (e, timelineElements, state, xOffsetZeroOne) => {
  if (e.isPrimary && e.target.hasPointerCapture(e.pointerId)) {
    const thisOffsetX =
      xOffsetZeroOne -
      (state.handleDragOffsetX - state.handleStartOffsetXZeroOne);
    const minRange = 1 / getMaxXZoom(timelineElements.canvas.width, state);
    if (state.currentAction === "resize-left") {
      state.left = Math.max(0, Math.min(state.right, thisOffsetX));
      if (state.right - state.left < minRange) {
        state.left = state.right - minRange;
      }
    } else if (state.currentAction === "resize-right") {
      state.right = Math.min(1, Math.max(state.left, thisOffsetX));
      if (state.right - state.left < minRange) {
        state.right = state.left + minRange;
      }
    }
    state.zoomX = 1 / (state.right - state.left);
    timelineElements.overlayCanvas.dispatchEvent(
      new CustomEvent("range-change", {
        detail: {
          startZeroOne: state.left,
          endZeroOne: state.right,
          initialRender: false,
        },
      })
    );
  }
};

export const initTimeline = (root, sharedState, timelineElements) => {
  const state = {
    currentAction: null,
    handleStartOffsetXZeroOne: undefined,
    handleDragOffsetX: undefined,
    pinchRaf: undefined,
    left: 0,
    right: 1,
    top: 1,
    bottom: 0,
    pinchStarted: false,
    panStarted: false,
    initialPinchXLeftZeroOne: 0,
    initialPinchXRightZeroOne: 1,
    zoomX: 1,
    isDarkTheme: true,
    numAudioSamples: 0,
    drawTimelineUI,
    pointers: {},
    customInteractionMode: false,
    scrubGlobalStarted: false,
    scrubLocalStarted: false,
    overLeftHandle: false,
    overRightHandle: false,
    overPanHandle: false,
    overSeekTrack: false,
  };

  state.drawTimelineUI = drawTimelineUI(timelineElements, state);

  const hitTestTimeline = (xOffsetZeroOne) => {
    //console.log("hitTestTimeline", xOffsetZeroOne);
    const resizeHandleWidthCssPx = 44;
    const handleWidthZeroOne =
      resizeHandleWidthCssPx /
      (timelineElements.canvas.width / devicePixelRatio);

    let leftResizeLeft = Math.max(0, state.left - handleWidthZeroOne * 0.5);
    let leftResizeRight = leftResizeLeft + handleWidthZeroOne;
    let rightResizeRight = Math.min(1, state.right + handleWidthZeroOne * 0.5);
    let rightResizeLeft = rightResizeRight - handleWidthZeroOne;

    // TODO: Correctly handle if the pan handle is very narrow at either extreme of the timeline.
    const panHandleWidth = rightResizeLeft - leftResizeRight;
    if (panHandleWidth < handleWidthZeroOne) {
      leftResizeLeft = Math.max(
        0,
        state.left -
        handleWidthZeroOne * 0.5 -
        (handleWidthZeroOne - panHandleWidth) * 0.5
      );
      rightResizeRight = Math.min(
        1,
        state.right +
        handleWidthZeroOne * 0.5 +
        (handleWidthZeroOne - panHandleWidth) * 0.5
      );
    }
    rightResizeLeft = rightResizeRight - handleWidthZeroOne;
    if (leftResizeLeft === 0 && rightResizeLeft < handleWidthZeroOne) {
      leftResizeLeft = -handleWidthZeroOne;
    }
    leftResizeRight = leftResizeLeft + handleWidthZeroOne;
    rightResizeLeft = rightResizeRight - handleWidthZeroOne;

    // const ctx = timelineElements.timelineUICanvas.getContext("2d");
    // ctx.save();
    // ctx.strokeStyle = 'red';
    // console.log("leftResizeLeft", leftResizeLeft);
    // console.log("rightResizeLeft", rightResizeLeft);
    // ctx.strokeRect(leftResizeLeft * ctx.canvas.width, 0, (leftResizeRight - leftResizeLeft) * ctx.canvas.width, ctx.canvas.height);
    // ctx.strokeRect(rightResizeLeft * ctx.canvas.width, 0, (rightResizeRight - rightResizeLeft) * ctx.canvas.width, ctx.canvas.height);
    // ctx.restore();

    const inResizeHandleLeft =
      xOffsetZeroOne >= leftResizeLeft && xOffsetZeroOne <= leftResizeRight;
    const inResizeHandleRight =
      xOffsetZeroOne >= rightResizeLeft && xOffsetZeroOne <= rightResizeRight;
    const inMainPanHandle =
      xOffsetZeroOne >= leftResizeLeft && xOffsetZeroOne <= rightResizeRight;
    const inSeekTrack = !inMainPanHandle;
    const targetChanged =
      state.overLeftHandle !== inResizeHandleLeft ||
      state.overRightHandle !== inResizeHandleRight ||
      state.overPanHandle !== inMainPanHandle ||
      state.overSeekTrack !== inSeekTrack;
    state.overLeftHandle = inResizeHandleLeft;
    state.overRightHandle = inResizeHandleRight;
    state.overPanHandle = inMainPanHandle;
    state.overSeekTrack = inSeekTrack;
    return {
      inResizeHandleLeft,
      inResizeHandleRight,
      inSeekTrack,
      targetChanged,
    };
  };

  timelineElements.timelineUICanvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.pointerType === "mouse" && e.button !== 0) {
      // Only response to left mouse clicks
      return;
    }
    const xOffsetZeroOne =
      e.offsetX / (timelineElements.canvas.width / devicePixelRatio);
    const {
      inResizeHandleLeft,
      inResizeHandleRight,
      inSeekTrack,
      targetChanged,
    } = hitTestTimeline(xOffsetZeroOne);

    let redrawnUI = false;
    if (inSeekTrack) {
      // Clicking outside handle.
      if (!state.currentAction) {
        clickOutsideHandle(state, timelineElements, xOffsetZeroOne);
        redrawnUI = true;
      }
    } else {
      if (inResizeHandleLeft) {
        startHandleResize(
          e,
          timelineElements,
          state,
          xOffsetZeroOne,
          "resize-left"
        );
      } else if (inResizeHandleRight) {
        startHandleResize(
          e,
          timelineElements,
          state,
          xOffsetZeroOne,
          "resize-right"
        );
      } else {
        startHandleDrag(e, timelineElements, state, xOffsetZeroOne);
      }
      redrawnUI = true;
    }
    if (targetChanged && !redrawnUI) {
      // Redraw UI for i.e. hover events
      timelineElements.overlayCanvas.dispatchEvent(
        new Event("interaction-target-changed")
      );
    }
  });
  timelineElements.timelineUICanvas.addEventListener("pointerup", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (state.currentAction !== null) {
      switch (state.currentAction) {
        case "pan":
          endHandleDrag(e, timelineElements, state);
          break;
        case "resize-left":
        case "resize-right":
          endHandleResize(e, timelineElements, state);
          break;
      }
    }
  });
  timelineElements.timelineUICanvas.addEventListener("pointerleave", () => {
    state.overSeekTrack = false;
    state.overLeftHandle = false;
    state.overRightHandle = false;
    state.overPanHandle = false;
    timelineElements.overlayCanvas.dispatchEvent(
      new Event("interaction-target-changed")
    );
  });
  timelineElements.timelineUICanvas.addEventListener("pointermove", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const xOffsetZeroOne =
      e.offsetX / (timelineElements.timelineUICanvas.width / devicePixelRatio);
    if (state.currentAction !== null) {
      switch (state.currentAction) {
        case "pan":
          dragHandle(e, timelineElements, state, xOffsetZeroOne);
          break;
        case "resize-left":
        case "resize-right":
          dragResize(e, timelineElements, state, xOffsetZeroOne);
          break;
      }
    } else if (e.pressure === 0 && e.pointerType === "mouse") {
      const {
        inResizeHandleLeft,
        inResizeHandleRight,
        inSeekTrack,
        targetChanged,
      } = hitTestTimeline(xOffsetZeroOne);

      // Add classes to DOM for cursors?
      if (inResizeHandleLeft || inResizeHandleRight) {
        if (!timelineElements.timelineUICanvas.classList.contains("resize")) {
          timelineElements.timelineUICanvas.classList.add("resize");
        }
      } else if (!inSeekTrack) {
        if (timelineElements.timelineUICanvas.classList.contains("resize")) {
          timelineElements.timelineUICanvas.classList.remove("resize");
        }
        timelineElements.timelineUICanvas.classList.add("grab");
      } else {
        if (
          timelineElements.timelineUICanvas.classList.contains("grab") ||
          timelineElements.timelineUICanvas.classList.contains("resize") ||
          timelineElements.timelineUICanvas.classList.contains("grabbing")
        ) {
          timelineElements.timelineUICanvas.classList.remove(
            "grab",
            "resize",
            "grabbing"
          );
        }
      }
      if (targetChanged) {
        // Redraw UI for i.e. hover events
        timelineElements.overlayCanvas.dispatchEvent(
          new Event("interaction-target-changed")
        );
      }
    }
  });

  const hitTestScrubHandles = (x, y) => {
    const numPointers = Object.keys(state.pointers).length;
    const atBottom = y > timelineElements.canvas.height / devicePixelRatio - 44;
    const atTop = y < 44;
    let inLocalPlaybackScrubberHandle = false;
    let inGlobalPlaybackScrubberHandle = false;
    if (numPointers < 2 && (atTop || atBottom)) {
      const audioProgressZeroOne = state.audioState.audioProgressZeroOne;
      const minHandleWidth = 44;
      const width =
        timelineElements.mainPlayheadCanvas.width / devicePixelRatio;
      if (
        atTop &&
        audioProgressZeroOne >= state.left &&
        audioProgressZeroOne <= state.right
      ) {
        const localProgress =
          (audioProgressZeroOne - state.left) / (state.right - state.left);
        const localPlaybackLeft = Math.max(
          0,
          localProgress * width - minHandleWidth / 2
        );
        const localPlaybackRight = localPlaybackLeft + minHandleWidth;
        if (x >= localPlaybackLeft && x <= localPlaybackRight) {
          inLocalPlaybackScrubberHandle = true;
        }
      } else if (atBottom) {
        const globalPlaybackLeft = Math.max(
          0,
          audioProgressZeroOne * width - minHandleWidth / 2
        );
        const globalPlaybackRight = globalPlaybackLeft + minHandleWidth;
        if (x >= globalPlaybackLeft && x <= globalPlaybackRight) {
          inGlobalPlaybackScrubberHandle = true;
        }
      }
    }
    const targetChanged =
      state.inLocalPlaybackScrubberHandle !== inLocalPlaybackScrubberHandle ||
      state.inGlobalPlaybackScrubberHandle !== inGlobalPlaybackScrubberHandle;
    state.inLocalPlaybackScrubberHandle = inLocalPlaybackScrubberHandle;
    state.inGlobalPlaybackScrubberHandle = inGlobalPlaybackScrubberHandle;

    return {
      inLocalPlaybackScrubberHandle,
      inGlobalPlaybackScrubberHandle,
      targetChanged,
    };
  };

  timelineElements.timelineUICanvas.addEventListener("pointercancel", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (state.currentAction !== null) {
      switch (state.currentAction) {
        case "pan":
          endHandleDrag(e, timelineElements, state);
          break;
        case "resize-left":
        case "resize-right":
          endHandleResize(e, timelineElements, state);
          break;
      }
    }
  });
  timelineElements.overlayCanvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const xOffset =
      e.offsetX / (timelineElements.canvas.width / devicePixelRatio);
    const dY = e.deltaY;
    let amount;
    if (Math.floor(dY) === dY) {
      // This is a mousewheel event (with integer values).
      amount = -e.deltaY * 0.001;
    } else {
      // This is likely a trackpad pinch event (with real number values)
      amount = -e.deltaY * 0.01;
    }
    updateZoom(xOffset, amount, state, sharedState, timelineElements);
  });
  timelineElements.timelineUICanvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const xOffset =
      e.offsetX / (timelineElements.canvas.width / devicePixelRatio);
    const dY = e.deltaY;
    let amount;
    if (Math.floor(dY) === dY) {
      // This is a mousewheel event (with integer values).
      amount = -e.deltaY * 0.001;
    } else {
      // This is likely a trackpad pinch event (with real number values)
      amount = -e.deltaY * 0.01;
    }
    const inHandle = xOffset >= state.left && xOffset <= state.right;
    if (inHandle) {
      updateZoom(xOffset, amount, state, sharedState, timelineElements);
    }
  });
  timelineElements.overlayCanvas.addEventListener("pointerdown", (e) => {
    if (
      e.pointerType === "touch" ||
      (e.pointerType === "mouse" && e.button !== -1) ||
      e.pressure > 0
    ) {
      e.preventDefault();
      let numPointers = Object.keys(state.pointers).length;
      if (numPointers < 2) {
        state.pointers[e.pointerId] = {
          x: e.offsetX,
          y: e.offsetY,
          time: performance.now(),
        };
        timelineElements.overlayCanvas.setPointerCapture(e.pointerId);
      }
      const {inLocalPlaybackScrubberHandle, inGlobalPlaybackScrubberHandle} =
        hitTestScrubHandles(e.offsetX, e.offsetY);
      state.interactionStartX = e.offsetX;
      state.interactionStartY = e.offsetY;
      const width =
        timelineElements.mainPlayheadCanvas.width / devicePixelRatio;
      if (state.customInteractionMode) {
        root.dispatchEvent(
          new CustomEvent("custom-interaction-start", {
            bubbles: false,
            composed: true,
            cancelable: false,
            detail: {
              offsetX: e.offsetX,
              offsetY: e.offsetY,
              container: timelineElements.overlayCanvas,
            },
          })
        );
      }
      if (state.customInteractionMode && state.inCustomInteraction) {
        // Don't start drags etc.
      } else {
        if (inGlobalPlaybackScrubberHandle) {
          // Drag global playtime scrubber
          state.scrubGlobalStarted = true;

          state.scrubDragOffsetX =
            e.offsetX - state.audioState.audioProgressZeroOne * width;
          state.startPlayheadDrag();
          if (e.pointerType === "mouse") {
            if (
              !timelineElements.spectrogramContainer.classList.contains(
                "dragging"
              )
            ) {
              timelineElements.spectrogramContainer.classList.add("dragging");
            }
          }
        } else if (inLocalPlaybackScrubberHandle) {
          // Drag local playtime scrubber
          state.scrubLocalStarted = true;
          const localProgress =
            (state.audioState.audioProgressZeroOne - state.left) /
            (state.right - state.left);
          state.scrubDragOffsetX = e.offsetX - localProgress * width;
          state.startPlayheadDrag();
          if (e.pointerType === "mouse") {
            if (
              !timelineElements.spectrogramContainer.classList.contains(
                "dragging"
              )
            ) {
              timelineElements.spectrogramContainer.classList.add("dragging");
            }
          }
        }
      }
    }
  });
  timelineElements.overlayCanvas.addEventListener("pointerleave", () => {
    state.inGlobalPlaybackScrubberHandle = false;
    state.inLocalPlaybackScrubberHandle = false;
    timelineElements.overlayCanvas.dispatchEvent(
      new Event("interaction-target-changed")
    );
  });

  timelineElements.overlayCanvas.addEventListener("pointermove", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (
      e.pointerType === "touch" ||
      (e.pointerType === "mouse" && e.button !== -1) ||
      e.pressure > 0
    ) {
      state.pointers[e.pointerId] = {
        x: e.offsetX,
        y: e.offsetY,
        time: performance.now(),
      };
      if (state.customInteractionMode && state.inCustomInteraction) {
        // Do nothing.
        root.dispatchEvent(
          new CustomEvent("custom-interaction-move", {
            bubbles: false,
            composed: true,
            cancelable: false,
            detail: {
              offsetX: e.offsetX,
              offsetY: e.offsetY,
              container: timelineElements.overlayCanvas,
            },
          })
        );
      } else {
        onPointerMove(timelineElements.overlayCanvas, state, sharedState);
        if (state.panStarted && e.pointerType === "mouse") {
          if (
            !timelineElements.spectrogramContainer.classList.contains(
              "dragging"
            )
          ) {
            timelineElements.spectrogramContainer.classList.add("dragging");
          }
        }
      }
    } else if (e.pointerType === "mouse" && e.pressure === 0) {
      const {targetChanged} = hitTestScrubHandles(e.offsetX, e.offsetY);
      if (targetChanged) {
        timelineElements.overlayCanvas.dispatchEvent(
          new Event("interaction-target-changed")
        );
      }
      // NOTE: Re-dispatch mousemove for user/client embed handling.
      root.dispatchEvent(
        new CustomEvent("move", {
          bubbles: false,
          composed: true,
          cancelable: false,
          detail: {
            offsetX: e.offsetX,
            offsetY: e.offsetY,
            container: timelineElements.spectrogramContainer,
          },
        })
      );
    }
  });

  const distanceBetweenPoints = (x1, y1, x2, y2) => {
    const dX = Math.abs(x1 - x2);
    const dY = Math.abs(y1 - y2);
    return Math.sqrt(dX * dX + dY * dY);
  };
  const clampZeroOne = (x) => Math.max(0, Math.min(1, x));

  const endPointerInteraction = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    const maxDoubleClickIntervalMs = 200;
    timelineElements.overlayCanvas.releasePointerCapture(e.pointerId);
    let doubleClickEventEmitted = false;

    let wasInCustomInteraction =
      state.customInteractionMode && state.inCustomInteraction;
    if (state.customInteractionMode && state.inCustomInteraction) {
      root.dispatchEvent(
        new CustomEvent("custom-interaction-end", {
          composed: true,
          bubbles: false,
          cancelable: false,
          detail: {
            offsetX: e.offsetX,
            offsetY: e.offsetY,
            container: timelineElements.overlayCanvas,
          },
        })
      );
    } else {
      // Check if we're in a double click
      if (
        state.pointers[e.pointerId] &&
        Object.keys(state.pointers).length === 1
      ) {
        const timeElapsed =
          performance.now() - state.pointers[e.pointerId].time;
        const distanceMoved = distanceBetweenPoints(
          state.pointers[e.pointerId].x,
          state.pointers[e.pointerId].y,
          e.offsetX,
          e.offsetY
        );
        // NOTE: This need to be a double-click, because a single click action would clash with the select action
        //  We need to delay the select action my `maxDoubleClickInterval` to make sure
        //  it wasn't the beginning of a double-click action.
        if (distanceMoved < 4 * devicePixelRatio && timeElapsed < 200) {
          clearTimeout(state.selectPending);
          if (state.doubleClickInProgress) {
            const timeElapsed =
              performance.now() - state.doubleClickInProgress.time;
            const distanceMoved = distanceBetweenPoints(
              state.doubleClickInProgress.x,
              state.doubleClickInProgress.y,
              e.offsetX,
              e.offsetY
            );
            if (
              distanceMoved < 4 * devicePixelRatio &&
              timeElapsed < maxDoubleClickIntervalMs
            ) {
              const offsetZeroOne =
                e.offsetX / (timelineElements.canvas.width / devicePixelRatio);
              const c = clampZeroOne(offsetZeroOne);
              const audioOffsetZeroOne =
                state.left + c * (state.right - state.left);
              doubleClickEventEmitted = true;
              timelineElements.overlayCanvas.dispatchEvent(
                new CustomEvent("double-click", {
                  detail: {
                    audioOffsetZeroOne,
                  },
                })
              );
            }
          }
          state.doubleClickInProgress = {
            x: e.offsetX,
            y: e.offsetY,
            time: performance.now(),
          };
        }
      }
    }
    delete state.pointers[e.pointerId];
    const numPointers = Object.keys(state.pointers).length;
    if (!wasInCustomInteraction) {
      if (numPointers < 2) {
        if (sharedState.interacting && state.pinchStarted) {
          timelineElements.overlayCanvas.dispatchEvent(
            new Event("interaction-end")
          );
        }
        state.pinchStarted = false;
      }
      if (numPointers < 1) {
        if (state.scrubLocalStarted || state.scrubGlobalStarted) {
          state.endPlayheadDrag();
        }

        const pointerMoved = () => {
          const dX = Math.abs(state.interactionStartX - e.offsetX);
          const dY = Math.abs(state.interactionStartY - e.offsetY);
          return dX > 4 || dY > 4;
        };
        const movedEnough = pointerMoved();
        if (
          !movedEnough ||
          (!state.scrubLocalStarted &&
            !state.scrubGlobalStarted &&
            !state.pinchStarted &&
            (!state.panStarted || (state.panStarted && !movedEnough)))
        ) {
          // Clicked without moving pointer
          if (!doubleClickEventEmitted) {
            const x = e.offsetX;
            const y = e.offsetY;
            state.selectPending = setTimeout(() => {
              root.dispatchEvent(
                new CustomEvent("select", {
                  bubbles: false,
                  composed: true,
                  cancelable: false,
                  detail: {
                    offsetX: x,
                    offsetY: y,
                    container: timelineElements.spectrogramContainer,
                  },
                })
              );
            }, maxDoubleClickIntervalMs);
          }
        }
        if (
          timelineElements.spectrogramContainer.classList.contains("dragging")
        ) {
          timelineElements.spectrogramContainer.classList.remove("dragging");
        }

        state.panStarted = false;
        state.scrubGlobalStarted = false;
        state.scrubLocalStarted = false;
        state.pinchStarted = false;
      }
    }
    if (numPointers < 1 && sharedState.interacting) {
      timelineElements.overlayCanvas.dispatchEvent(
        new Event("interaction-end")
      );
    }
  };

  timelineElements.overlayCanvas.addEventListener(
    "pointerup",
    endPointerInteraction
  );
  timelineElements.overlayCanvas.addEventListener(
    "pointercancel",
    endPointerInteraction
  );

  const curriedSetInitialZoom = (left, right, top, bottom, initial, final) =>
    setInitialZoom(
      left,
      right,
      top,
      bottom,
      state,
      sharedState,
      timelineElements,
      initial,
      final
    );
  return {
    drawTimelineUI: drawTimelineUI(timelineElements, state),
    timelineState: state,
    animateToRange,
    getMaxXZoom: () => getMaxXZoom(timelineElements.canvas.width, state),
    getMaxYZoom: () => getMaxYZoom(timelineElements.canvas.height),
    resetYZoom: () =>
      animateToRange(
        state.left,
        state.right,
        state.top,
        state.bottom,
        state.left,
        state.right,
        1,
        0,
        100,
        (left, right, top, bottom, final) =>
          curriedSetInitialZoom(left, right, top, bottom, false, final)
      ),
    setInitialZoom: curriedSetInitialZoom,
  };
};

const clickOutsideHandle = (state, timelineElements, offsetXZeroOne) => {
  const range = state.right - state.left;
  let targetStart = Math.max(0, offsetXZeroOne - range * 0.5);
  let targetEnd = targetStart + range;
  if (targetEnd > 1) {
    targetEnd = 1;
    targetStart = targetEnd - range;
  }
  const initialStart = state.left;
  const initialEnd = state.right;
  timelineElements.overlayCanvas.dispatchEvent(new Event("interaction-begin"));
  animateToRange(
    initialStart,
    initialEnd,
    state.top,
    state.bottom,
    targetStart,
    targetEnd,
    state.top,
    state.bottom,
    200,
    (start, end, _top, _bottom, _final) => {
      state.left = start;
      state.right = end;
      timelineElements.overlayCanvas.dispatchEvent(
        new CustomEvent("range-change", {
          detail: {
            startZeroOne: state.left,
            endZeroOne: state.right,
            initialRender: false,
            force: false,
          },
        })
      );
    }
  ).then(() => {
    timelineElements.overlayCanvas.dispatchEvent(new Event("interaction-end"));
  });
};

const animate = async (callback) => {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      callback();
      resolve();
    });
  });
};

const clamp = (val) => Math.min(1, Math.max(0, val));

const smoothStep = (val) => {
  const t = clamp(val);
  return t * t * (3.0 - 2.0 * t);
};

const animateToRange = async (
  initialStart,
  initialEnd,
  initialTop,
  initialBottom,
  targetStart,
  targetEnd,
  targetTop,
  targetBottom,
  durationMs,
  update
) => {
  // TODO: Make max duration 200ms, but if the distance between the start range and the end range
  //  is small, make the duration relative to that.
  const startTime = performance.now();
  const endTime = startTime + durationMs;
  let tt = startTime;
  const startRange = targetStart - initialStart;
  const endRange = targetEnd - initialEnd;
  const topRange = targetTop - initialTop;
  const bottomRange = targetBottom - initialBottom;
  while (tt < endTime) {
    await animate(() => {
      // Map tt into zeroToOne space
      tt = performance.now();
      // Smoothly interpolate initialStart to targetStart over a given duration.
      const t = smoothStep(mapRange(tt, startTime, endTime, 0, 1));
      const startT = Math.max(0, initialStart + startRange * t);

      const endT = Math.min(1, initialEnd + endRange * t);
      const topT = Math.min(1, initialTop + topRange * t);
      const bottomT = Math.max(0, initialBottom + bottomRange * t);
      // update tween
      update(startT, endT, topT, bottomT, false);
    });
  }
  const forceRenderFinalFrame = true;
  await animate(() =>
    update(
      targetStart,
      targetEnd,
      targetTop,
      targetBottom,
      forceRenderFinalFrame
    )
  );
};
