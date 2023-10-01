const black = 255 << 24 | 0 << 16 | 0 << 8 | 0;
const white = 255 << 24 | 255 << 16 | 255 << 8 | 255;
const red = 255 << 24 | 255 << 16 | 0 << 8 | 0;
const green = 255 << 24 | 0 << 16 | 255 << 8 | 0;
const blue = 255 << 24 | 0 << 16 | 0 << 8 | 255;

// TODO: Make the scrubber work, and maybe make the resize handles work.
//  Make panning with the mouse work. Add resistance and bounce via smoothstep.



// const renderRange = (ctx, startZeroOne, endZeroOne, vFocalPointZeroOne) => {
//   ctx.save();
//   const height = ctx.canvas.height;
//   const width = ctx.canvas.width;
//   const zoom = (endZeroOne - startZeroOne) * width;
//   ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
//   ctx.drawImage(canvasImageBitmap, width * startZeroOne, 0, zoom, height, 0, 0, width, height);
//   ctx.restore();
// };
export const adjustZoom = (e, state, sharedState, timelineElements) => {
  e.preventDefault();
  const pXRatio = (e.x - timelineElements.canvas.getBoundingClientRect().left) / timelineElements.canvas.width;
  updateZoom(pXRatio, -e.deltaY * 0.001, state, sharedState, timelineElements);
}

const getMaxZoom = (canvas, state) => {
  const audioSamples = state.numAudioSamples;
  if (audioSamples) {
    // About 180 samples per pixel looks about max res at FFT size of 2048
    return audioSamples / canvas.width / 180;
  } else {
    return 16;
  }
}


const updateZoom = (pXRatio, zoomAmount, state, sharedState, timelineElements) => {
  // Save prev zoom level
  const visiblePortionI = 1 / state.zoomX;
  const invisiblePortionI = 1 - visiblePortionI; // How much offscreen to distribute.

  // Update zoom level
  state.zoomX += Math.min(1, zoomAmount);
  state.zoomX = Math.max(1, state.zoomX);
  state.zoomX = Math.min(getMaxZoom(timelineElements.canvas, state), state.zoomX);
  // See how much zoom level has changed, and how much we have to distribute.
  const visiblePortion = 1 / state.zoomX;
  const invisiblePortion = 1 - visiblePortion; // How much offscreen to distribute.
  // Distribute proportionally on either side of pX the increase in width/zoom.
  const newWToDistribute = invisiblePortion - invisiblePortionI;
  const leftShouldTake = newWToDistribute * pXRatio;
  const rightShouldTake = (newWToDistribute) * (1 - pXRatio);
  const prevLeft = state.left;
  const prevRight = state.right;

  state.left += leftShouldTake;
  state.left = Math.max(0, state.left);
  // NOTE: Balance out if one side took less than it's fair share.
  const leftTook = state.left - prevLeft;

  state.right -= ((newWToDistribute) * (1 - pXRatio));
  state.right -= Math.min(0, leftShouldTake - leftTook);
  state.right = Math.min(1, state.right);

  // NOTE: If right didn't take everything it could, redistribute to the left.
  const rightTook = prevRight - state.right;
  state.left += Math.min(0, rightShouldTake - rightTook);
  // positionHandles(left, right);
  // await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, left, right);

  if (!sharedState.interacting) {
    timelineElements.canvas.dispatchEvent(new Event("interaction-begin"));
    clearTimeout(sharedState.interactionTimeout);
    sharedState.interactionTimeout = setTimeout(() => {
      timelineElements.canvas.dispatchEvent(new Event("interaction-end"));
    }, 300);
  }

  timelineElements.canvas.dispatchEvent(new CustomEvent("range-change", {
    detail: {
      startZeroOne: state.left,
      endZeroOne: state.right,
      initialRender: false,
    }
  }));
}

const updatePinch = (xStartPxRatio, xEndPxRatio, initialXStartPxRatio, initialXEndPxRatio, state, canvas) => {
  // Range between two points.  This should remain constant
  const initialRatio = initialXEndPxRatio - initialXStartPxRatio;
  const newRatio = xEndPxRatio - xStartPxRatio;
  const zoomX = newRatio / initialRatio;
  const visiblePortionI = 1 / zoomX;
  //console.log("R", xStartPxRatio / zoomX);
  let initialLeft =  initialXStartPxRatio - (xStartPxRatio / zoomX);
  let initialRight = initialLeft + visiblePortionI;

  const range = initialXEndPxRatio - initialXStartPxRatio;
  //console.log("updatePinch", initialLeft, initialRight, range);

  const maxOutOfBounds = range * 0.25;
  // If left or right is outside the 0..1 bounds, start to add resistance, proportional to how much over it is.

  if (initialLeft < 0) {
    // Allow up to a 25% of viewport outside bounds based on the current zoom level.
    // At the current zoom, what represents 25% of the viewport?
    // console.log(initialLeft, maxOutOfBounds);
    // const amount = Math.min(1, Math.max(0.5, Math.abs(initialLeft)));
    // const inv = 1 - amount;
    // console.log("I", inv, "A", amount, "L", initialLeft * inv);
    //left *= (inv * inv);
    const a = Math.max(-maxOutOfBounds, initialLeft);
    const b = (Math.abs(a) / 2);

    //console.log("II", Math.abs(initialLeft) * 4);
    //const c = (((Math.sqrt(b) / -b) + 1) * 2.3);
    const c = Math.sqrt(b) / 3;

    //console.log(initialLeft, a, b, c);
    initialLeft = c * a;
    initialRight = initialLeft + visiblePortionI;
  } else if (initialRight > 1) {
    initialLeft = initialRight - visiblePortionI;
  }

  state.left = Math.max(0, initialLeft);
  state.right = Math.min(1, initialRight);

  //console.log("i", state.left, state.right);
  console.log("update pinch range change");
  canvas.dispatchEvent(new CustomEvent("range-change", {
    detail: {
      startZeroOne: state.left,
      endZeroOne: state.right,
      initialRender: false,
    }
  }));
  // await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, state.left, state.right);
  // positionHandles(state.left, state.right);
}



const onTouchMove = (e, canvas, state) => {
  e.preventDefault();
  if (e.touches.length <= 2) {
    const canvasX = canvas.getBoundingClientRect().left;
    let pinchXLeftZeroOne;
    let pinchXRightZeroOne;
    if (e.touches.length === 2) {
      const x0 = e.touches[0].clientX - canvasX;
      const x1 = e.touches[1].clientX - canvasX;
      pinchXLeftZeroOne = Math.max(0, Math.min(x0, x1) / canvas.width);
      pinchXRightZeroOne = Math.min(1, Math.max(x0, x1) / canvas.width);
      if (!state.pinchStarted) {
        state.pinchStarted = true;
        const range = state.right - state.left;
        state.initialPinchXLeftZeroOne = state.left + (range * pinchXLeftZeroOne);
        state.initialPinchXRightZeroOne = state.left + (range * pinchXRightZeroOne);
      }
    } else if (e.touches.length === 1) {
      const x0 = e.touches[0].clientX - canvasX;
      const range = state.right - state.left;
      pinchXLeftZeroOne = Math.max(0, x0 / canvas.width);
      pinchXRightZeroOne = pinchXLeftZeroOne + range;
      if (!state.pinchStarted && !state.panStarted) {
        state.panStarted = true;
        state.initialPinchXLeftZeroOne = Math.max(0, state.left + (range * pinchXLeftZeroOne));
        state.initialPinchXRightZeroOne = Math.min(1, state.left + (range * pinchXRightZeroOne));
        console.log("Start pan", "left", state.initialPinchXLeftZeroOne, "right", state.initialPinchXRightZeroOne);
      }
    }
    // TODO: We may want to allow pinching in to less than 100%, and then bounce back out.
    updatePinch(pinchXLeftZeroOne, pinchXRightZeroOne, state.initialPinchXLeftZeroOne, state.initialPinchXRightZeroOne, state, canvas);
  }
};
const onPointerMove = (e, canvas, state) => {
  if (e.pressure > 0) {
    const canvasBounds = canvas.getBoundingClientRect();
    const canvasX = canvasBounds.left;
    const x0 = e.clientX - canvasX;
    const range = state.right - state.left;
    //console.log("panRange", range);
    let pinchXLeftZeroOne = Math.max(0, x0 / canvas.width);
    let pinchXRightZeroOne = Math.min(1, pinchXLeftZeroOne + range);
    console.log(pinchXLeftZeroOne, pinchXRightZeroOne);
    if (!state.panStarted) {
      state.panStarted = true;
      canvas.classList.add("grabbing");
      state.panRange = range;
      state.initialPinchXLeftZeroOne = pinchXLeftZeroOne;
      //state.initialPinchXRightZeroOne = state.right;
        //state.initialPinchXLeftZeroOne = Math.max(0, state.left + (range * pinchXLeftZeroOne));
      //state.initialPinchXRightZeroOne = Math.min(1, state.left + (range * pinchXRightZeroOne));
      //console.log("Start pan", "left", state.initialPinchXLeftZeroOne, "right", state.initialPinchXRightZeroOne, "range", state.initialPinchXRightZeroOne - state.initialPinchXLeftZeroOne);
    }


    // state.left = state.initialPinchXLeftZeroOne + pinchXLeftZeroOne;
    // state.right = state.left + range;
    //
    // canvas.dispatchEvent(new CustomEvent("range-change", {
    //   detail: {
    //     startZeroOne: state.left,
    //     endZeroOne: state.right,
    //     initialRender: false,
    //   }
    // }));
    //updatePinch(pinchXLeftZeroOne, pinchXRightZeroOne, state.initialPinchXLeftZeroOne, state.initialPinchXRightZeroOne, state, canvas);


    // {
    //   const initialRatio = state.initialPinchXRightZeroOne - state.initialPinchXLeftZeroOne;
    //   const newRatio = pinchXRightZeroOne - pinchXLeftZeroOne;
    //   const zoomX = newRatio / initialRatio;
    //   const visiblePortionI = 1 / zoomX;
    //   //console.log("R", xStartPxRatio / zoomX);
    //   let initialLeft = state.initialPinchXLeftZeroOne - (pinchXLeftZeroOne / zoomX);
    //   let initialRight = initialLeft + visiblePortionI;
    //
    //   const range = initialRatio;
    //   //console.log("updatePinch", initialLeft, initialRight, range);
    //
    //   const maxOutOfBounds = range * 0.25;
    //   // If left or right is outside the 0..1 bounds, start to add resistance, proportional to how much over it is.
    //
    //   // if (initialLeft < 0) {
    //   //   // Allow up to a 25% of viewport outside bounds based on the current zoom level.
    //   //   // At the current zoom, what represents 25% of the viewport?
    //   //   // console.log(initialLeft, maxOutOfBounds);
    //   //   // const amount = Math.min(1, Math.max(0.5, Math.abs(initialLeft)));
    //   //   // const inv = 1 - amount;
    //   //   // console.log("I", inv, "A", amount, "L", initialLeft * inv);
    //   //   //left *= (inv * inv);
    //   //   const a = Math.max(-maxOutOfBounds, initialLeft);
    //   //   const b = (Math.abs(a) / 2);
    //   //
    //   //   //console.log("II", Math.abs(initialLeft) * 4);
    //   //   //const c = (((Math.sqrt(b) / -b) + 1) * 2.3);
    //   //   const c = Math.sqrt(b) / 3;
    //   //
    //   //   //console.log(initialLeft, a, b, c);
    //   //   initialLeft = c * a;
    //   //   initialRight = initialLeft + visiblePortionI;
    //   // } else if (initialRight > 1) {
    //   //   initialLeft = initialRight - visiblePortionI;
    //   // }
    //
    //   state.left = initialLeft;
    //   state.right = initialLeft + range;
    //
    //   //console.log("i", state.left, state.right);
    //
    //   canvas.dispatchEvent(new CustomEvent("range-change", {
    //     detail: {
    //       startZeroOne: state.left,
    //       endZeroOne: state.right,
    //       initialRender: false,
    //     }
    //   }));
    // }


  }
};


// const initContext = async () => {
//   if (!canvasImageData) {
//     const height = ctx.canvas.height;
//     const width = ctx.canvas.width;
//     const yInc = 30;
//     const xInc = 100;
//     const yH = height / yInc;
//     const xW = width / xInc;
//     canvasImageData = ctx.getImageData(0, 0, width, height);
//     const canvasData = new Uint32Array(canvasImageData.data.buffer);
//     for (let y = 0; y < height; y++) {
//       const yOn = Math.floor(y / yH) % 2 === 0;
//       for (let x = 0; x < width; x++) {
//         const idx = (y * width) + x;
//         const xOn = Math.floor(x / xW) % 2 === 0;
//         let c = black;
//         if (xOn) {
//           if (Math.floor(x / xW) % 5 === 0) {
//             c = red;
//           } else if (Math.floor(x / xW) % 4 === 0) {
//             c = green;
//           } else if (Math.floor(x / xW) % 3 === 0) {
//             c = blue;
//           }
//         }
//
//         if (xOn && yOn || (!yOn && !xOn)) {
//           canvasData[idx] = c;
//         } else {
//           canvasData[idx] = white;
//         }
//       }
//     }
//     ctx.putImageData(canvasImageData, 0, 0);
//     // ctx.fillStyle = "deeppink";
//     // ctx.fillRect(0.6 * width, 0, 10, height);
//     // ctx.fillStyle = "aqua";
//     // ctx.fillRect(0.4 * width, 0, 10, height);
//     canvasImageData = ctx.getImageData(0, 0, width, height);
//     canvasImageBitmap = await createImageBitmap(canvasImageData);
//   }
// };

// let handleDragOffsetX;
// let handleStartOffsetXZeroOne;
//
// let capturedElement = null;
// let handleGrabXOffset;
const startHandleDrag = (e, timelineElements, timelineState) => {
  //console.log("Pointer down", e);

  if (e.isPrimary && !timelineState.capturedElement) {
    const handle = timelineElements.handle;
    const handleParent = timelineElements.handle.parentElement;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("grabbing");
    timelineState.capturedElement = handle;
    const pBounds = handleParent.getBoundingClientRect();
    const hBounds = handle.getBoundingClientRect();
    timelineState.handleStartOffsetXZeroOne = (hBounds.left - pBounds.left) / pBounds.width;
    timelineState.handleDragOffsetX = (e.clientX - pBounds.left) / pBounds.width;
    timelineElements.canvas.dispatchEvent(new Event("interaction-begin"));
  }
};

const endHandleDrag = (e, timelineElements, state) => {
  if (e.isPrimary) {
    timelineElements.handle.releasePointerCapture(e.pointerId);
    timelineElements.handle.classList.remove("grabbing");
    state.capturedElement = null;
    timelineElements.canvas.dispatchEvent(new Event("interaction-end"));
  }
};

const dragHandle = (e, timelineElements, state) => {

  const handle = timelineElements.handle;
  const handleParent = timelineElements.handle.parentElement;
  if (e.isPrimary && e.target.hasPointerCapture(e.pointerId) && state.capturedElement === handle) {
    const pBounds = handleParent.getBoundingClientRect();
    const thisOffsetX = (e.clientX - pBounds.left) / pBounds.width;
    const xOffset = state.handleDragOffsetX - state.handleStartOffsetXZeroOne;
    //cancelAnimationFrame(state.pinchRaf);

    const range = state.right - state.left;

    // Can we move?
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
  //}
  // await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, state.left, state.right);
  // positionHandles(state.left, state.right);
  timelineElements.canvas.dispatchEvent(new CustomEvent("range-change", {
    detail: {
      startZeroOne: state.left,
      endZeroOne: state.right,
      initialRender: false,
    }
  }));
    //});
  }
};

export const positionHandles = (timelineElements) => (startZeroOne, endZeroOne) => {
  timelineElements.handle.style.left = `${Math.min(1, Math.max(0, startZeroOne)) * 100}%`;
  timelineElements.handle.style.right = `${(1 - Math.max(0, Math.min(1, endZeroOne))) * 100}%`;

  timelineElements.leftOfHandle.style.right = `${(1 - startZeroOne) * 100}%`;
  timelineElements.rightOfHandle.style.left = `${endZeroOne * 100}%`;

  // TODO: Also handle being at the edge of a screen, or a clipping parent element with overflow hidden.
  // Move the handleLeft/handleRight offsets to maintain a minimum gap of 44px between them.
  const handleWidth = timelineElements.handle.getBoundingClientRect().width;
  if (handleWidth < 88) {
    const grabOffset = (handleWidth - 44) / 2;
    timelineElements.handleLeftInner.style.left = `${Math.max(-44, -(22 + (22 - grabOffset)))}px`;
    timelineElements.handleRightInner.style.left = `${Math.min(0, -grabOffset)}px`;
  } else {
    timelineElements.handleLeftInner.style.left = `${-22}px`;
    timelineElements.handleRightInner.style.left = `${-22}px`;
  }
}


const startHandleResize = (e, timelineElements, state) => {
  if (e.isPrimary && !state.capturedElement) {
    const target = e.target;
    target.setPointerCapture(e.pointerId);
    state.capturedElement = target;
    // TODO: Get half width from DOM?
    state.handleGrabXOffset = -22 + e.offsetX;
    timelineElements.canvas.dispatchEvent(new Event("interaction-begin"));
  }
}
const endHandleResize = (e, timelineElements, state) => {
  if (e.isPrimary) {
    const target = e.target;
    if (state.capturedElement === target) {
      target.releasePointerCapture(e.pointerId);
      state.capturedElement = null;
      timelineElements.canvas.dispatchEvent(new Event("interaction-end"));
    }
  }
};
const dragResize = (e, timelineElements, state) => {
  if (e.isPrimary && e.target.hasPointerCapture(e.pointerId)) {
    const pBounds = timelineElements.handle.parentElement.getBoundingClientRect();
    const thisOffsetX = (e.clientX - pBounds.left - state.handleGrabXOffset) / pBounds.width;
    const minRange = 1 / getMaxZoom(timelineElements.canvas, state);
    if (e.target === timelineElements.handleLeftInner) {
      state.left = Math.max(0, Math.min(state.right, thisOffsetX));

      if (state.right - state.left < minRange) {
        state.left = state.right - minRange;
      }
    } else if (e.target === timelineElements.handleRightInner) {
      state.right = Math.min(1, Math.max(state.left, thisOffsetX));

      if (state.right - state.left < minRange) {
        state.right = state.left + minRange;
      }
    }

    state.zoomX = 1 / (state.right - state.left);

    // TODO: Maybe just emit an event saying that the range has changed?
    // cancelAnimationFrame(state.pinchRaf);
    // state.pinchRaf = requestAnimationFrame(() => {
    //   //await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, state.left, state.right);
    //   // timelineElements.canvas.dispatchEvent(new Event("range-change", {
    //   //   left: state.left,
    //   //   right: state.right
    //   // }));
    //   state.positionHandles(state.left, state.right);
    // });
    //console.log("drag resize range change");
    timelineElements.canvas.dispatchEvent(new CustomEvent("range-change", {
      detail: {
        startZeroOne: state.left,
        endZeroOne: state.right,
        initialRender: false,
      }
    }));
  }
};

// const plot = document.getElementById("plot");
// const ctx2 = plot.getContext("2d");
// let x = 0;
// while (x < plot.width) {
//   x += 1;
// }

// let handle;
// let handleLeftInner;
// let handleRightInner;
// let leftOfHandle;
// let rightOfHandle;
// let playheadScrubber;
// let ctx;
// let miniMapCtx;
// let mainPlayheadCanvasCtx;
// let playheadCanvasCtx;
// let mainPlayheadScrubber;
export const initTimeline = (sharedState, timelineElements, numAudioSamples) => {
  // ctx = canvas.getContext("2d");
  // miniMapCtx = miniMapCanvas.getContext("2d");
  // handle = handleRef;
  // handleLeftInner = handleLeftInnerRef;
  // handleRightInner = handleRightInnerRef;
  // leftOfHandle = leftOfHandleRef;
  // rightOfHandle = rightOfHandleRef;
  // playheadScrubber = playheadScrubberRef;
  // mainPlayheadScrubber= mainPlayheadScrubberRef;
  // mainPlayheadCanvasCtx = mainPlayheadCanvas.getContext("2d");
  // playheadCanvasCtx = playheadCanvas.getContext("2d");

  const state = {
    capturedElement: null,
    handleStartOffsetXZeroOne: undefined,
    handleDragOffsetX: undefined,
    pinchRaf: undefined,
    left: 0,
    right: 1,
    pinchStarted: false,
    panStarted: false,
    initialPinchXLeftZeroOne: 0,
    initialPinchXRightZeroOne: 1,
    panRange: 1,
    zoomX: 1,
    numAudioSamples,
    positionHandles: positionHandles(timelineElements)
  }
  // Checker board
  //await initContext();
  // Set initial canvas size.
  timelineElements.handle.addEventListener("pointerdown", (e) => startHandleDrag(e, timelineElements, state));
  timelineElements.handle.addEventListener("pointermove", (e) => dragHandle(e, timelineElements, state));
  timelineElements.handle.addEventListener("pointerup", (e) => endHandleDrag(e, timelineElements, state));



  timelineElements.handleLeftInner.addEventListener("pointerdown", (e) => startHandleResize(e, timelineElements, state));
  timelineElements.handleLeftInner.addEventListener("pointermove", (e) => dragResize(e, timelineElements, state));
  timelineElements.handleLeftInner.addEventListener("pointerup", (e) => endHandleResize(e, timelineElements, state));

  timelineElements.handleRightInner.addEventListener("pointerdown", (e) => startHandleResize(e, timelineElements, state));
  timelineElements.handleRightInner.addEventListener("pointermove", (e) => dragResize(e, timelineElements, state));
  timelineElements.handleRightInner.addEventListener("pointerup", (e) => endHandleResize(e, timelineElements, state));

  timelineElements.leftOfHandle.addEventListener("click", (e) => clickOutsideHandle(e, state, timelineElements));
  timelineElements.rightOfHandle.addEventListener("click", (e) => clickOutsideHandle(e, state, timelineElements));


  // FIXME
  timelineElements.canvas.addEventListener("wheel", (e) => adjustZoom(e, state, sharedState, timelineElements));
  timelineElements.canvas.addEventListener("touchmove", (e) => onTouchMove(e, timelineElements.canvas, state));
  timelineElements.canvas.addEventListener("touchend", (e) => {
    if (e.touches.length === 1 && state.pinchStarted) {
      // Going from two to one fingers
      // state.panRange = state.right - state.left;
      state.pinchStarted = false;
      state.panStarted = false;
    }
    else if (e.touches.length === 0) {
      state.pinchStarted = false;
      state.panStarted = false;
    }

    // TODO: On release, if we're out of bounds, start an animation to bounce it back to be in range.
  });
  timelineElements.canvas.addEventListener("pointermove", (e) => onPointerMove(e, timelineElements.canvas, state));
  timelineElements.canvas.addEventListener("pointerup", (e) => {
    timelineElements.canvas.classList.remove("grabbing");
    state.pinchStarted = false;
    state.panStarted = false;
    // TODO: On release, if we're out of bounds, start an animation to bounce it back to be in range.
  });
  return { positionHandles: positionHandles(timelineElements), timelineState: state }
}

const clickOutsideHandle = (e, state, timelineElements) => {
  const target = e.target;
  const pBounds = target.parentElement.getBoundingClientRect();
  const offsetZeroOne = (e.clientX - pBounds.left) / pBounds.width;

  // TODO: Animate to range.

  // Get the width of the handle:
  const range = state.right - state.left;
  state.left = Math.max(0, offsetZeroOne - (range * 0.5));
  state.right = state.left + range;
  if (state.right > 1) {
    state.right = 1;
    state.left = state.right - range;
  }
  // await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, state.left, state.right);
  // await positionHandles(state)(state.left, state.right);
  //console.log("click outside handle range change");
  timelineElements.canvas.dispatchEvent(new CustomEvent("range-change", {
    detail: {
      startZeroOne: state.left,
      endZeroOne: state.right,
      initialRender: false,
    }
  }));
};

// export const startSpan = async () => {
//   // start: 4120338 ..0.28457847
//   // end: 4310645 ..0.29772236
//   // left = 0.28457847;
//   // right = 0.29772236;
//   left = 0.2;
//   right = 0.7;
//
//   left = 0.19047619;
//   right = 0.38095238;
//
//   left = 0.28571429;
//   right = 0.47619048;
//
//   left = 0.42857143;
//   right = 0.80952381;
//
//   // left = 0;
//   // right = 1;
//
//   zoomX = 1 / (right - left);
//
//   await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, left, right);
//   await positionHandles(left, right);
//   // await updateZoom(0.2, 1);
//   // await updateZoom(0.2, 1);
//   // await updateZoom(0.2, 1);
//   // await updateZoom(0.2, 1);
//   // await updateZoom(0.2, 1);
//   // await updateZoom(0.2, 1);
//   // await updateZoom(0.2, 1);
//   // await updateZoom(0.2, 1);
//   // await updateZoom(0.2, 1);
//   // await updateZoom(0.2, 1);
//   // await updateZoom(0.2, 1);
//   // await updateZoom(0.2, 1);
//
//   // TODO: Animate zooms to areas of interest.
// }

// export const renderInitial = async () => {
//   left = 0;
//   right = 1;
//   zoomX = 1;
//   await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, left, right, true);
//   await positionHandles(left, right);
// }
