import {numAudioSamples, renderRange, } from "./spectrogram-renderer.js";

const black = 255 << 24 | 0 << 16 | 0 << 8 | 0;
const white = 255 << 24 | 255 << 16 | 255 << 8 | 255;
const red = 255 << 24 | 255 << 16 | 0 << 8 | 0;
const green = 255 << 24 | 0 << 16 | 255 << 8 | 0;
const blue = 255 << 24 | 0 << 16 | 0 << 8 | 255;

// TODO: Make the scrubber work, and maybe make the resize handles work.
//  Make panning with the mouse work. Add resistance and bounce via smoothstep.


let zoomX = 1;
let left = 0;
let right = 1;
let canvasImageData;
let canvasImageBitmap;

// const renderRange = (ctx, startZeroOne, endZeroOne, vFocalPointZeroOne) => {
//   ctx.save();
//   const height = ctx.canvas.height;
//   const width = ctx.canvas.width;
//   const zoom = (endZeroOne - startZeroOne) * width;
//   ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
//   ctx.drawImage(canvasImageBitmap, width * startZeroOne, 0, zoom, height, 0, 0, width, height);
//   ctx.restore();
// };
export const adjustZoom = async (e) => {
  e.preventDefault();
  const pXRatio = (e.x - ctx.canvas.getBoundingClientRect().left) / ctx.canvas.width;
  await updateZoom(pXRatio, -e.deltaY * 0.001);
}

const getMaxZoom = () => {
  const audioSamples = numAudioSamples();
  if (audioSamples) {
    // About 180 samples per pixel looks about max res at FFT size of 2048
    return audioSamples / ctx.canvas.width / 180;
  } else {
    return 16;
  }
}


const updateZoom = async (pXRatio, zoomAmount) => {
  // Save prev zoom level
  const visiblePortionI = 1 / zoomX;
  const invisiblePortionI = 1 - visiblePortionI; // How much offscreen to distribute.

  // Update zoom level
  zoomX += Math.min(1, zoomAmount);
  zoomX = Math.max(1, zoomX);
  zoomX = Math.min(getMaxZoom(), zoomX);
  // See how much zoom level has changed, and how much we have to distribute.
  const visiblePortion = 1 / zoomX;
  const invisiblePortion = 1 - visiblePortion; // How much offscreen to distribute.
  // Distribute proportionally on either side of pX the increase in width/zoom.
  const newWToDistribute = invisiblePortion - invisiblePortionI;
  const leftShouldTake = newWToDistribute * pXRatio;
  const rightShouldTake = (newWToDistribute) * (1 - pXRatio);
  const prevLeft = left;
  const prevRight = right;

  left += leftShouldTake;
  left = Math.max(0, left);
  // NOTE: Balance out if one side took less than it's fair share.
  const leftTook = left - prevLeft;

  right -= ((newWToDistribute) * (1 - pXRatio));
  right -= Math.min(0, leftShouldTake - leftTook);
  right = Math.min(1, right);

  // NOTE: If right didn't take everything it could, redistribute to the left.
  const rightTook = prevRight - right;
  left += Math.min(0, rightShouldTake - rightTook);
  positionHandles(left, right);
  await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, left, right);
}

const updatePinch = async (xStartPxRatio, xEndPxRatio, initialXStartPxRatio, initialXEndPxRatio) => {
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

  left = initialLeft;
  right = initialRight;
  await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, left, right);
  positionHandles(left, right);
}

const resizeCanvas = (canvas) => {
  const bounds = canvas.parentElement.getBoundingClientRect();
  const canvasBounds = canvas.getBoundingClientRect();
  canvas.style.height = `${canvas.height}px`;
  canvas.height = canvas.height * devicePixelRatio;
  canvas.width = bounds.width * devicePixelRatio;
  canvas.style.width = `${bounds.width}px`;
};

let pinchRaf;
let dragPlayheadRaf;
let pinchStarted = false;
let panStarted = false;
let panRange = 1;
let initialPinchXLeftZeroOne = 0;
let initialPinchXRightZeroOne = 1;
const onTouchMove = (e) => {
  e.preventDefault();
  if (e.touches.length <= 2) {
    const canvasX = ctx.canvas.getBoundingClientRect().left;
    let pinchXLeftZeroOne;
    let pinchXRightZeroOne;
    if (e.touches.length === 2) {
      const x0 = e.touches[0].clientX - canvasX;
      const x1 = e.touches[1].clientX - canvasX;
      pinchXLeftZeroOne = Math.max(0, Math.min(x0, x1) / ctx.canvas.width);
      pinchXRightZeroOne = Math.min(1, Math.max(x0, x1) / ctx.canvas.width);
      if (!pinchStarted) {
        pinchStarted = true;
        const range = right - left;
        initialPinchXLeftZeroOne = left + (range * pinchXLeftZeroOne);
        initialPinchXRightZeroOne = left + (range * pinchXRightZeroOne);
      }
    } else if (e.touches.length === 1) {
      const x0 = e.touches[0].clientX - canvasX;
      pinchXLeftZeroOne = Math.max(0, x0 / ctx.canvas.width);
      pinchXRightZeroOne = pinchXLeftZeroOne + panRange;
      if (!pinchStarted && !panStarted) {
        panStarted = true;
        const range = right - left;
        initialPinchXLeftZeroOne = left + (range * pinchXLeftZeroOne);
        initialPinchXRightZeroOne = left + (range * pinchXRightZeroOne);
        console.log("Start pan", "left", initialPinchXLeftZeroOne, "right", initialPinchXRightZeroOne);
      }
    }
    // TODO: We may want to allow pinching in to less than 100%, and then bounce back out.
    cancelAnimationFrame(pinchRaf);
    pinchRaf = requestAnimationFrame(async () => {
      await updatePinch(pinchXLeftZeroOne, pinchXRightZeroOne, initialPinchXLeftZeroOne, initialPinchXRightZeroOne);
    });
  }
};
const onPointerMove = (e) => {
  if (e.pressure > 0) {
    const canvasX = ctx.canvas.getBoundingClientRect().left;
    const x0 = e.clientX - canvasX;
    let pinchXLeftZeroOne = Math.max(0, x0 / ctx.canvas.width);
    let pinchXRightZeroOne = pinchXLeftZeroOne + panRange;
    if (!panStarted) {
      panStarted = true;
      ctx.canvas.classList.add("grabbing");
      const range = right - left;
      initialPinchXLeftZeroOne = left + (range * pinchXLeftZeroOne);
      initialPinchXRightZeroOne = left + (range * pinchXRightZeroOne);
      console.log("Start pan", "left", initialPinchXLeftZeroOne, "right", initialPinchXRightZeroOne);
    }
    cancelAnimationFrame(pinchRaf);
    pinchRaf = requestAnimationFrame(async () => {
      await updatePinch(pinchXLeftZeroOne, pinchXRightZeroOne, initialPinchXLeftZeroOne, initialPinchXRightZeroOne);
    });
  }
};


const initContext = async () => {
  if (!canvasImageData) {
    const height = ctx.canvas.height;
    const width = ctx.canvas.width;
    const yInc = 30;
    const xInc = 100;
    const yH = height / yInc;
    const xW = width / xInc;
    canvasImageData = ctx.getImageData(0, 0, width, height);
    const canvasData = new Uint32Array(canvasImageData.data.buffer);
    for (let y = 0; y < height; y++) {
      const yOn = Math.floor(y / yH) % 2 === 0;
      for (let x = 0; x < width; x++) {
        const idx = (y * width) + x;
        const xOn = Math.floor(x / xW) % 2 === 0;
        let c = black;
        if (xOn) {
          if (Math.floor(x / xW) % 5 === 0) {
            c = red;
          } else if (Math.floor(x / xW) % 4 === 0) {
            c = green;
          } else if (Math.floor(x / xW) % 3 === 0) {
            c = blue;
          }
        }

        if (xOn && yOn || (!yOn && !xOn)) {
          canvasData[idx] = c;
        } else {
          canvasData[idx] = white;
        }
      }
    }
    ctx.putImageData(canvasImageData, 0, 0);
    // ctx.fillStyle = "deeppink";
    // ctx.fillRect(0.6 * width, 0, 10, height);
    // ctx.fillStyle = "aqua";
    // ctx.fillRect(0.4 * width, 0, 10, height);
    canvasImageData = ctx.getImageData(0, 0, width, height);
    canvasImageBitmap = await createImageBitmap(canvasImageData);
  }
};

let handleDragOffsetX;
let handleStartOffsetXZeroOne;

let capturedElement = null;
let handleGrabXOffset;
const startHandleDrag = (e) => {
  //console.log("Pointer down", e);
  if (e.isPrimary && !capturedElement) {
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("grabbing");
    capturedElement = handle;
    const pBounds = handle.parentElement.getBoundingClientRect();
    const hBounds = handle.getBoundingClientRect();
    handleStartOffsetXZeroOne = (hBounds.left - pBounds.left) / pBounds.width;
    handleDragOffsetX = (e.clientX - pBounds.left) / pBounds.width;
    //handleGrabXZeroOne = e.offsetX / hBounds.width;
  }
};

const endHandleDrag = (e) => {
  if (e.isPrimary) {
    handle.releasePointerCapture(e.pointerId);
    handle.classList.remove("grabbing");
    capturedElement = null;
  }
};

const dragHandle = (e) => {
  if (e.isPrimary && e.target.hasPointerCapture(e.pointerId) && capturedElement === handle) {
    const pBounds = handle.parentElement.getBoundingClientRect();
    const thisOffsetX = (e.clientX - pBounds.left) / pBounds.width;
    const xOffset = handleDragOffsetX - handleStartOffsetXZeroOne;
    cancelAnimationFrame(pinchRaf);
    pinchRaf = requestAnimationFrame(async () => {
      {
        const range = right - left;

        // Can we move?
        let initialLeft = left;
        let initialRight = right;


        left = thisOffsetX - xOffset;
        right = left + range;

        if (left < 0 || right > 1) {
          if (right > 1 && left > 0) {
            right = 1;
            left = right - range;
          } else if (left < 0 && right < 1) {
            left = 0;
            right = left + range;
          } else {
            left = initialLeft;
            right = initialRight;
          }
        }
      }
      await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, left, right);
      positionHandles(left, right);
    });
  }
};

export const positionHandles = (startZeroOne, endZeroOne) => {
  handle.style.left = `${Math.min(1, Math.max(0, startZeroOne)) * 100}%`;
  handle.style.right = `${(1 - Math.max(0, Math.min(1, endZeroOne))) * 100}%`;

  leftOfHandle.style.right = `${(1 - startZeroOne) * 100}%`;
  rightOfHandle.style.left = `${endZeroOne * 100}%`;

  // TODO: Also handle being at the edge of a screen, or a clipping parent element with overflow hidden.
  // Move the handleLeft/handleRight offsets to maintain a minimum gap of 44px between them.
  const handleWidth = handle.getBoundingClientRect().width;
  if (handleWidth < 88) {
    const grabOffset = (handleWidth - 44) / 2;
    handleLeftInner.style.left = `${Math.max(-44, -(22 + (22 - grabOffset)))}px`;
    handleRightInner.style.left = `${Math.min(0, -grabOffset)}px`;
  } else {
    handleLeftInner.style.left = `${-22}px`;
    handleRightInner.style.left = `${-22}px`;
  }
}


const startHandleResize = (e) => {
  if (e.isPrimary && !capturedElement) {
    const target = e.target;
    target.setPointerCapture(e.pointerId);
    capturedElement = target;
    handleGrabXOffset = -22 + e.offsetX;
  }
}
const endHandleResize = (e) => {
  if (e.isPrimary) {
    const target = e.target;
    if (capturedElement === target) {
      target.releasePointerCapture(e.pointerId);
      capturedElement = null;
    }
  }
};
const dragResize = (e) => {
  if (e.isPrimary && e.target.hasPointerCapture(e.pointerId)) {
    const pBounds = handle.parentElement.getBoundingClientRect();
    const thisOffsetX = (e.clientX - pBounds.left - handleGrabXOffset) / pBounds.width;
    const minRange = 1 / getMaxZoom();
    if (e.target === handleLeftInner) {
      left = Math.max(0, Math.min(right, thisOffsetX));

      if (right - left < minRange) {
        left = right - minRange;
      }
    } else if (e.target === handleRightInner) {
      right = Math.min(1, Math.max(left, thisOffsetX));

      if (right - left < minRange) {
        right = left + minRange;
      }
    }

    zoomX = 1 / (right - left);

    cancelAnimationFrame(pinchRaf);
    pinchRaf = requestAnimationFrame(async () => {
      await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, left, right);
      positionHandles(left, right);
    });
  }
};

// const plot = document.getElementById("plot");
// const ctx2 = plot.getContext("2d");
// let x = 0;
// while (x < plot.width) {
//   x += 1;
// }

let handle;
let handleLeftInner;
let handleRightInner;
let leftOfHandle;
let rightOfHandle;
let playheadScrubber;
let ctx;
let miniMapCtx;
let mainPlayheadCanvasCtx;
let playheadCanvasCtx;
let mainPlayheadScrubber;
export const initTimeline = async (canvas, mainPlayheadCanvas, mainPlayheadScrubberRef, miniMapCanvas, playheadCanvas, handleRef, handleLeftInnerRef, handleRightInnerRef, leftOfHandleRef, rightOfHandleRef, playheadScrubberRef) => {
  ctx = canvas.getContext("2d");
  miniMapCtx = miniMapCanvas.getContext("2d");
  handle = handleRef;
  handleLeftInner = handleLeftInnerRef;
  handleRightInner = handleRightInnerRef;
  leftOfHandle = leftOfHandleRef;
  rightOfHandle = rightOfHandleRef;
  playheadScrubber = playheadScrubberRef;
  mainPlayheadScrubber= mainPlayheadScrubberRef;
  mainPlayheadCanvasCtx = mainPlayheadCanvas.getContext("2d");
  playheadCanvasCtx = playheadCanvas.getContext("2d");

  resizeCanvas(canvas);
  resizeCanvas(mainPlayheadCanvas);
  resizeCanvas(miniMapCanvas);
  resizeCanvas(playheadCanvas);

  // Checker board
  //await initContext();
  // Set initial canvas size.
  handle.addEventListener("pointerdown", startHandleDrag);
  handle.addEventListener("pointermove", dragHandle);
  handle.addEventListener("pointerup", endHandleDrag);



  handleLeftInner.addEventListener("pointerdown", startHandleResize);
  handleLeftInner.addEventListener("pointermove", dragResize);
  handleLeftInner.addEventListener("pointerup", endHandleResize);

  handleRightInner.addEventListener("pointerdown", startHandleResize);
  handleRightInner.addEventListener("pointermove", dragResize);
  handleRightInner.addEventListener("pointerup", endHandleResize);

  leftOfHandle.addEventListener("click", clickOutsideHandle);
  rightOfHandle.addEventListener("click", clickOutsideHandle);

  window.addEventListener("resize", () => resizeCanvas(canvas));
  canvas.addEventListener("wheel", adjustZoom);
  canvas.addEventListener("touchmove", onTouchMove);
  canvas.addEventListener("touchend", (e) => {
    if (e.touches.length === 1 && pinchStarted) {
      // Going from two to one fingers
      panRange = right - left;
      pinchStarted = false;
      panStarted = false;
    }
    else if (e.touches.length === 0) {
      pinchStarted = false;
      panStarted = false;
    }

    // TODO: On release, if we're out of bounds, start an animation to bounce it back to be in range.
  });
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", (e) => {
    ctx.canvas.classList.remove("grabbing");
    pinchStarted = false;
    panStarted = false;
    // TODO: On release, if we're out of bounds, start an animation to bounce it back to be in range.
  });
  //await adjustZoom({ preventDefault: () => {}, x: 0, deltaY: 0 });
}

const clickOutsideHandle = async (e) => {
  const target = e.target;
  const pBounds = target.parentElement.getBoundingClientRect();
  const offsetZeroOne = (e.clientX - pBounds.left) / pBounds.width;

  // TODO: Animate to range.

  // Get the width of the handle:
  const range = right - left;
  left = Math.max(0, offsetZeroOne - (range * 0.5));
  right = left + range;
  if (right > 1) {
    right = 1;
    left = right - range;
  }
  await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, left, right);
  await positionHandles(left, right);
};

export const startSpan = async () => {
  // start: 4120338 ..0.28457847
  // end: 4310645 ..0.29772236
  // left = 0.28457847;
  // right = 0.29772236;
  left = 0.2;
  right = 0.7;

  left = 0.19047619;
  right = 0.38095238;

  left = 0.28571429;
  right = 0.47619048;

  left = 0.42857143;
  right = 0.80952381;

  // left = 0;
  // right = 1;

  zoomX = 1 / (right - left);

  await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, left, right);
  await positionHandles(left, right);
  // await updateZoom(0.2, 1);
  // await updateZoom(0.2, 1);
  // await updateZoom(0.2, 1);
  // await updateZoom(0.2, 1);
  // await updateZoom(0.2, 1);
  // await updateZoom(0.2, 1);
  // await updateZoom(0.2, 1);
  // await updateZoom(0.2, 1);
  // await updateZoom(0.2, 1);
  // await updateZoom(0.2, 1);
  // await updateZoom(0.2, 1);
  // await updateZoom(0.2, 1);

  // TODO: Animate zooms to areas of interest.
}

export const renderInitial = async () => {
  left = 0;
  right = 1;
  zoomX = 1;
  await renderRange(ctx, miniMapCtx, playheadCanvasCtx, playheadScrubber, mainPlayheadCanvasCtx, mainPlayheadScrubber, left, right, true);
  await positionHandles(left, right);
}
