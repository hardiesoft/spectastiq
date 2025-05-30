export default (spectastiq, rois) => {
  let currentPalette = spectastiq.colorScheme;
  let selectionRangeStartZeroOne = 0;
  let selectionRangeEndZeroOne = 1;
  let inRegionResizeMode = false;
  let inRegionCreationMode = false;
  let selectedRoi = null;
  let audioSampleRate = 48000;
  let audioDuration = 1;
  let audioIsPlaying = false;
  let pointerPositionX = -1;
  let pointerPositionY = -1;
  let regionCreationStartX = -1;
  let regionCreationStartY = -1;
  let regionCreationEndX = -1;
  let regionCreationEndY = -1;
  let isDarkTheme = currentPalette !== "Grey";
  let selectedTrackFeature = null;
  let hoveredTrackFeature = null;
  let grabOffsetX = 0;
  let grabOffsetY = 0;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let canvasCtx = null;

  const TagColours = [
    {background: "#d7df20", foreground: "dark"},
  ];
  const myRois = new Proxy(rois, {
    set(target, name, value, r) {
      target[name] = value;
      if (name === "length") {
        // Length change, rerender table
        renderRoiTableView();
      }
      return true;
    }
  });

  const minBoxDims = (minDim, box) => {
    const [x0, y0, x1, y1] = box;
    const w = x1 - x0;
    const h = y1 - y0;
    const cX = x0 + w * 0.5;
    const cY = y0 + h * 0.5;
    const newWidth = Math.max(minDim, w);
    const newHeight = Math.max(minDim, h);

    return [
      cX - newWidth * 0.5,
      cY - newHeight * 0.5,
      cX + newWidth * 0.5,
      cY + newHeight * 0.5,
    ];
  };

  const pointIsInExactBox = (x, y, box) => {
    const [x0, y0, x1, y1] = box;
    return x >= x0 && x < x1 && y >= y0 && y < y1;
  };

  const distanceBetween = (x1, y1, x2, y2) => {
    const dX = Math.abs(x1 - x2);
    const dY = Math.abs(y1 - y2);
    return Math.sqrt(dX * dX + dY * dY);
  };

  const pointIsInPaddedBox = (x, y, box) => {
    if (pointIsInExactBox(x, y, minBoxDims(44, box))) {
      const [x0, y0, x1, y1] = box;
      const w = x1 - x0;
      const h = y1 - y0;
      const cX = x0 + w * 0.5;
      const cY = y0 + h * 0.5;
      const leftEdgeDistance = Math.abs(x - x0);
      const topEdgeDistance = Math.abs(y - y0);
      const bottomEdgeDistance = Math.abs(y - y1);
      const rightEdgeDistance = Math.abs(x - x1);
      return Math.min(
        leftEdgeDistance,
        topEdgeDistance,
        bottomEdgeDistance,
        rightEdgeDistance,
        distanceBetween(x, y, cX, cY),
      );
    } else {
      return false;
    }
  };

  const padDims = (dims, paddingX, paddingY) => {
    return [
      dims[0] - paddingX,
      dims[1] - paddingY,
      dims[2] + paddingX,
      dims[3] + paddingY,
    ];
  };

  const getTrackBounds = (contextWidth, contextHeight, startZeroOne, endZeroOne, trackBox) => {
    let [left, top, right, bottom] = trackBox;
    top = spectastiq.transformY(1 - top);
    bottom = spectastiq.transformY(1 - bottom);
    left = Math.max(0, left);
    right = Math.min(1, right);
    const range = endZeroOne - startZeroOne;
    const l = (left - startZeroOne) / range;
    const r = (right - startZeroOne) / range;
    return [
      l * contextWidth,
      (1 - top) * contextHeight,
      r * contextWidth,
      (1 - bottom) * contextHeight,
    ];
  };

  const hitTestRegionFeatures = () => {
    const ctx = canvasCtx;
    const cWidth = ctx.canvas.width;
    const cHeight = ctx.canvas.height;
    if (
      !(
        inRegionResizeMode &&
        pointerPositionX >= 0 &&
        pointerPositionY >= 0 &&
        pointerPositionX <= cWidth &&
        pointerPositionY <= cHeight
      )
    ) {
      return null;
    }
    // Check distance from each corner of the currently selected track
    if (selectedRoi) {
      const roi = myRois.find(
        (roi) => roi === selectedRoi,
      );
      if (!roi) {
        return null;
      }
      const rangeBegin = selectionRangeStartZeroOne;
      const rangeEnd = selectionRangeEndZeroOne;


      const {start, end, minFreqHz, maxFreqHz} = roi.mutated
        ? roi.mutated
        : roi;

      const minFreqZeroOne =
        1 - Math.max(0, minFreqHz) / audioSampleRate;
      const maxFreqZeroOne =
        1 -
        Math.min(maxFreqHz, audioSampleRate) / audioSampleRate;
      const trackStartZeroOne = Math.max(0, start / audioDuration);
      const trackEndZeroOne = Math.min(1, end / audioDuration);
      const bounds = getTrackBounds(cWidth, cHeight, rangeBegin, rangeEnd, [
        trackStartZeroOne,
        maxFreqZeroOne,
        trackEndZeroOne,
        minFreqZeroOne,
      ]);

      const handleSize = 44 * devicePixelRatio;
      const handleRadius = handleSize / 2;
      const [left, top, right, bottom] = bounds;
      let bestDistance = Number.MAX_SAFE_INTEGER;
      selectedTrackFeature = null;
      grabOffsetX = 0;
      grabOffsetY = 0;
      resizeStartX = 0;
      resizeStartY = 0;
      for (const corner of [
        [left, top, "top-left"],
        [right, top, "top-right"],
        [right, bottom, "bottom-right"],
        [left, bottom, "bottom-left"],
      ]) {
        const [x, y, whichCorner] = corner;
        const dX = pointerPositionX - x / devicePixelRatio;
        const dY = pointerPositionY - y / devicePixelRatio;

        const distance = Math.sqrt(dX * dX + dY * dY);
        if (distance <= handleRadius) {
          if (distance < bestDistance) {
            selectedTrackFeature = whichCorner;
            grabOffsetX = dX;
            grabOffsetY = dY;
            resizeStartX = x;
            resizeStartY = y;
            bestDistance = distance;
          }
        }
      }
      if (selectedTrackFeature === null) {
        // Check if we're in the padded version of the box.
        const paddedBounds = padDims(bounds, handleSize / 2, handleSize / 2);
        const left = paddedBounds[0] / devicePixelRatio;
        const top = paddedBounds[1] / devicePixelRatio;
        const right = paddedBounds[2] / devicePixelRatio;
        const bottom = paddedBounds[3] / devicePixelRatio;
        if (
          pointIsInExactBox(pointerPositionX, pointerPositionY, [
            left,
            top,
            right,
            bottom,
          ])
        ) {
          grabOffsetX = pointerPositionX - bounds[0] / devicePixelRatio;
          grabOffsetY = pointerPositionY - bounds[1] / devicePixelRatio;
          selectedTrackFeature = "whole-track";
        }
      }
      if (selectedTrackFeature !== null) {
        return selectedTrackFeature;
      }
    }
  };

  const doResize = () => {
    if (selectedRoi) {
      const ctx = canvasCtx;
      // Work out what the new track bounds are and re-render
      const track = selectedRoi;
      // Update mutatedStart, mutatedEnd, mutatedMinFreq, mutatedMaxFreq
      if (!track.mutated) {
        track.mutated = {
          start: track.start,
          end: track.end,
          minFreqHz: track.minFreqHz,
          maxFreqHz: track.maxFreqHz,
        };
      }

      const begin = selectionRangeStartZeroOne;
      const end = selectionRangeEndZeroOne;
      const cHeight = ctx.canvas.height;
      const cWidth = ctx.canvas.width;
      const width = cWidth / devicePixelRatio;
      const height = cHeight / devicePixelRatio;
      const newX = pointerPositionX - grabOffsetX;
      const newY = pointerPositionY - grabOffsetY;
      const offsetX = Math.min(1, Math.max(0, newX / width));
      const offsetY = Math.min(1, Math.max(0, newY / height));
      const minFreqDeltaHz = 1000;
      const minTrackLengthSeconds = 1;
      const xZeroOne = begin + offsetX * (end - begin);
      if (
        selectedTrackFeature === "top-left" ||
        selectedTrackFeature === "bottom-left"
      ) {
        track.mutated.start = Math.min(
          xZeroOne * audioDuration,
          track.mutated.end - minTrackLengthSeconds,
        );
      } else if (
        selectedTrackFeature === "top-right" ||
        selectedTrackFeature === "bottom-right"
      ) {
        track.mutated.end = Math.max(
          track.mutated.start + minTrackLengthSeconds,
          xZeroOne * audioDuration,
        );
      }
      if (
        selectedTrackFeature === "top-left" ||
        selectedTrackFeature === "top-right"
      ) {
        track.mutated.maxFreqHz = Math.max(
          spectastiq.inverseTransformY(offsetY) * audioSampleRate,
          track.mutated.minFreqHz + minFreqDeltaHz,
        );
      } else if (
        selectedTrackFeature === "bottom-left" ||
        selectedTrackFeature === "bottom-right"
      ) {
        track.mutated.minFreqHz = Math.min(
          track.mutated.maxFreqHz - minFreqDeltaHz,
          spectastiq.inverseTransformY(offsetY) * audioSampleRate,
        );
      }
      if (selectedTrackFeature === "whole-track") {
        // Move the whole track around as long as its dimensions can stay the same.
        const newX = pointerPositionX - grabOffsetX;
        const newY = pointerPositionY - grabOffsetY;
        const offsetXLeft = newX / width;
        const offsetYTop = newY / height;

        const yZeroOne =
          spectastiq.inverseTransformY(offsetYTop) *
          audioSampleRate;
        const xZeroOne = begin + offsetXLeft * (end - begin);
        const trackWidth = track.end - track.start;
        track.mutated.start = Math.min(
          Math.max(0, xZeroOne * audioDuration),
          audioDuration - trackWidth,
        );

        track.mutated.end = Math.min(
          track.mutated.start + (track.end - track.start),
          audioDuration,
        );

        track.mutated.maxFreqHz = Math.min(
          Math.max(0, yZeroOne),
          audioSampleRate,
        );

        const deltaFreq = track.maxFreqHz - track.minFreqHz;
        track.mutated.minFreqHz = Math.min(
          Math.max(0, track.mutated.maxFreqHz - deltaFreq),
          audioSampleRate - deltaFreq,
        );
        track.mutated.maxFreqHz = track.mutated.minFreqHz + deltaFreq;
      }
      {
        const minFreqZeroOne =
          Math.max(0, track.mutated.minFreqHz || 0) / audioSampleRate;
        const maxFreqZeroOne =
          Math.min(
            track.mutated.maxFreqHz || audioSampleRate,
            audioSampleRate,
          ) / audioSampleRate;
        spectastiq.setPlaybackFrequencyBandPass(
          minFreqZeroOne * audioSampleRate,
          maxFreqZeroOne * audioSampleRate,
        );
      }
      renderOverlay();
    }
  };

  const renderOverlay = () => {
    const ctx = canvasCtx;
    const rangeBegin = selectionRangeStartZeroOne;
    const rangeEnd = selectionRangeEndZeroOne;
    const cHeight = ctx.canvas.height;
    const cWidth = ctx.canvas.width;
    ctx.save();
    ctx.clearRect(0, 0, cWidth, cHeight);
    // TODO: Can we re-implement create track in terms of a custom-interaction
    if (inRegionResizeMode && selectedRoi) {
      // Draw background with cutouts
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.beginPath();
      ctx.rect(0, 0, cWidth, cHeight);
      const roi = selectedRoi;
      const {start, end, minFreqHz, maxFreqHz} = roi.mutated
        ? roi.mutated
        : roi;

      const minFreqZeroOne =
        1 - Math.max(0, minFreqHz) / audioSampleRate;
      const maxFreqZeroOne =
        1 -
        Math.min(maxFreqHz, audioSampleRate) / audioSampleRate;
      const trackStartZeroOne = Math.max(0, start / audioDuration);
      const trackEndZeroOne = Math.min(1, end / audioDuration);
      const bounds = getTrackBounds(cWidth, cHeight, rangeBegin, rangeEnd, [
        trackStartZeroOne,
        maxFreqZeroOne,
        trackEndZeroOne,
        minFreqZeroOne,
      ]);
      const [left, top, right, bottom] = bounds;
      ctx.moveTo(left, top);
      ctx.lineTo(left, bottom);
      ctx.lineTo(right, bottom);
      ctx.lineTo(right, top);
      ctx.lineTo(left, top);
      ctx.fill();
    }
    for (let i = 0; i < myRois.length; i++) {
      const roi = myRois[i];
      const {start, end, minFreqHz, maxFreqHz} = roi.mutated
        ? roi.mutated
        : roi;
      const minFreqZeroOne =
        1 - Math.max(0, minFreqHz || 0) / audioSampleRate;
      const maxFreqZeroOne =
        1 -
        Math.min(maxFreqHz || 0, audioSampleRate) / audioSampleRate;
      const trackStartZeroOne = Math.max(0, start / audioDuration);
      const trackEndZeroOne = Math.min(1, end / audioDuration);
      const bounds = getTrackBounds(cWidth, cHeight, rangeBegin, rangeEnd, [
        trackStartZeroOne,
        maxFreqZeroOne,
        trackEndZeroOne,
        minFreqZeroOne,
      ]);
      const color = TagColours[i % TagColours.length].background;
      drawRectWithText(
        ctx,
        bounds,
        roi.label,
        myRois,
        window.devicePixelRatio,
        selectedRoi !== null,
        selectedRoi === roi,
        color
      );
    }
    if (inRegionCreationMode) {
      const left = Math.max(
        0,
        Math.min(pointerPositionX, regionCreationStartX),
      );
      const right = Math.max(pointerPositionX, regionCreationStartX);
      const top = Math.max(
        0,
        Math.min(pointerPositionY, regionCreationStartY),
      );
      const bottom = Math.max(pointerPositionY, regionCreationStartY);
      const x = left * devicePixelRatio;
      const y = top * devicePixelRatio;
      const width = Math.min((right - left) * devicePixelRatio, cWidth - x);
      const height = Math.min((bottom - top) * devicePixelRatio, cHeight - y);
      ctx.save();
      ctx.setLineDash([5 * devicePixelRatio, 5 * devicePixelRatio]);
      ctx.lineWidth = 1 * devicePixelRatio;
      ctx.strokeStyle = "white";
      ctx.strokeRect(x, y, width, height);
      ctx.restore();
    }
    ctx.restore();
  };

  const resizeCurrentlySelectedTrack = () => {
    inRegionResizeMode = true;
    spectastiq.enterCustomInteractionMode();
    renderOverlay();
  };

  const exitResizeMode = () => {
    inRegionResizeMode = false;
    spectastiq.exitCustomInteractionMode();
    renderOverlay();
  };

  const cancelTrackResizeOperation = () => {
    if (selectedRoi) {
      delete selectedRoi.mutated;
      // Set gain and bandpass for original unchanged track.
      const trackStartZeroOne = selectedRoi.start / audioDuration;
      const trackEndZeroOne = selectedRoi.end / audioDuration;
      const minFreqZeroOne =
        Math.max(0, selectedRoi.minFreqHz) / audioSampleRate;
      const maxFreqZeroOne = Math.min(selectedRoi.maxFreqHz, audioSampleRate) / audioSampleRate;
      const newGain = spectastiq.getGainForRegionOfInterest(trackStartZeroOne, trackEndZeroOne, minFreqZeroOne, maxFreqZeroOne);
      spectastiq.setGain(newGain);
      spectastiq.setPlaybackFrequencyBandPass(
        minFreqZeroOne * audioSampleRate,
        maxFreqZeroOne * audioSampleRate,
      );
    }
    exitResizeMode();
  };

  const selectRegionAndPlay = async (roi, shouldZoomToRegion = true, shouldPlay = true) => {
    selectedRoi = roi;
    renderOverlay();
    const roiStartZeroOne = Math.max(0, roi.start / audioDuration);
    const roiEndZeroOne = Math.min(1, roi.end / audioDuration);
    const minFreqZeroOne =
      Math.max(0, roi.minFreqHz) / audioSampleRate;
    const maxFreqZeroOne = Math.min(roi.maxFreqHz, audioSampleRate) / audioSampleRate;
    if (shouldZoomToRegion) {
      await spectastiq.selectRegionOfInterest(
        roiStartZeroOne,
        roiEndZeroOne,
        minFreqZeroOne,
        maxFreqZeroOne,
      );
      const newGain = spectastiq.getGainForRegionOfInterest(roiStartZeroOne, roiEndZeroOne, minFreqZeroOne, maxFreqZeroOne);
      spectastiq.setGain(newGain);
    }
    spectastiq.setPlaybackFrequencyBandPass(minFreqZeroOne * audioSampleRate, maxFreqZeroOne * audioSampleRate);
    if (shouldPlay) {
      await spectastiq.play(roiStartZeroOne, roiEndZeroOne);
    }
  };

  const drawRectWithText = (
    context,
    dims,
    label,
    tracks = [],
    pixelRatio,
    hasSelected,
    isSelected,
    color
  ) => {
    context.save();
    const drawResizeHandles = isSelected && inRegionResizeMode;
    const lineWidth = (isSelected ? 2 : 1) * pixelRatio;
    const outlineWidth = lineWidth + 2 * pixelRatio;
    const cWidth = context.canvas.width;
    const cHeight = context.canvas.height;
    const deviceRatio = pixelRatio;
    const [left, top, right, bottom] = dims;
    const width = right - left;
    const height = bottom - top;
    const x = left;
    const y = top;
    context.lineJoin = "round";
    context.lineWidth = outlineWidth;
    context.strokeStyle = `rgba(0, 0, 0, ${
      isSelected ? 0.4 : hasSelected ? 0.0 : 0.5
    })`;
    context.beginPath();
    context.strokeRect(x, y, width, height);
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5), 16);
    const strokeStyle = `rgba(${r}, ${g}, ${b}, ${
      isSelected ? 1.0 : hasSelected ? 0.5 : 1.0
    })`;
    context.strokeStyle = strokeStyle;
    context.lineWidth = lineWidth;
    context.beginPath();
    context.strokeRect(x, y, width, height);
    if (
      isSelected &&
      (left > 0 || right > 0) &&
      (left < cWidth || right < cWidth)
    ) {
      if (label !== null) {
        const text = label;
        const textHeight = 9 * deviceRatio;
        const marginX = 3 * deviceRatio;
        const marginTop = 3 * deviceRatio;
        let textX = x;
        let textY = bottom + marginTop;
        // Make sure the text doesn't get clipped off if the box is near the frame edges
        if (bottom + textHeight + marginTop * 2 < cHeight) {
          textY = bottom + marginTop;
        } else if (y - (textHeight + marginTop) > 0) {
          textY = top - (textHeight + marginTop * 2);
        } else if (textY + textHeight > cHeight) {
          textY = top + marginTop * 4;
          textX += 4 * deviceRatio;
        }
        context.textBaseline = "top";
        context.font = `${13 * deviceRatio}px sans-serif`;
        context.lineWidth = 4;
        context.textAlign = "left";
        if (x < 0) {
          textX = marginX;
        }

        context.strokeStyle = isDarkTheme ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.5)";
        context.strokeText(text, textX, textY);
        context.fillStyle = isDarkTheme ? "white" : "black";
        context.fillText(text, textX, textY);
      }

      if (drawResizeHandles) {
        for (const handle of [
          "top-left",
          "top-right",
          "bottom-left",
          "bottom-right",
        ]) {
          let x = 0;
          let y = 0;
          if (handle === "top-left" || handle === "bottom-left") {
            x = left;
          } else if (handle === "top-right" || handle === "bottom-right") {
            x = right;
          }
          if (handle === "top-left" || handle === "top-right") {
            y = top;
          } else if (handle === "bottom-left" || handle === "bottom-right") {
            y = bottom;
          }
          context.save();
          const hovered = hoveredTrackFeature === handle;
          {
            const handleSize = (hovered ? 15 : 10) * deviceRatio;
            context.fillStyle = "black";
            context.beginPath();
            context.arc(x, y, handleSize / 2, 0, 2 * Math.PI);
            context.fill();
          }
          context.restore();
          context.save();
          {
            const handleSize = (hovered ? 14 : 9) * deviceRatio;
            context.fillStyle = handle === hoveredTrackFeature ? "white" : strokeStyle;
            context.beginPath();
            context.arc(x, y, handleSize / 2, 0, 2 * Math.PI);
            context.fill();
          }
          context.restore();
        }
      }
    }
    context.restore();
  };

  spectastiq.addEventListener("custom-interaction-start", (e) => {
    pointerPositionX = e.detail.offsetX;
    pointerPositionY = e.detail.offsetY;
    if (inRegionResizeMode) {
      selectedTrackFeature = hitTestRegionFeatures();
      if (selectedTrackFeature !== null) {
        spectastiq.beginCustomInteraction();
      }
    } else if (inRegionCreationMode) {
      regionCreationStartX = pointerPositionX;
      regionCreationStartY = pointerPositionY;
      spectastiq.beginCustomInteraction();
    }
  });
  spectastiq.addEventListener("custom-interaction-move", (e) => {
    pointerPositionX = e.detail.offsetX;
    pointerPositionY = e.detail.offsetY;
    if (inRegionResizeMode) {
      doResize();
    } else if (inRegionCreationMode) {
      renderOverlay();
    }
  });
  spectastiq.addEventListener("custom-interaction-end", async (e) => {
    pointerPositionX = e.detail.offsetX;
    pointerPositionY = e.detail.offsetY;
    if (inRegionResizeMode) {
      // Copy mutated track back
      if (selectedRoi) {
        const track = selectedRoi;
        if (track.mutated) {
          track.start = track.mutated.start;
          track.end = track.mutated.end;
          track.minFreqHz = track.mutated.minFreqHz;
          track.maxFreqHz = track.mutated.maxFreqHz;
          delete track.mutated;

          // Set gain for new track
          const trackStartZeroOne = track.start / audioDuration;
          const trackEndZeroOne = track.end / audioDuration;
          const minFreqZeroOne =
            Math.max(0, track.minFreqHz) / audioSampleRate;
          const maxFreqZeroOne =
            Math.min(track.maxFreqHz, audioSampleRate) / audioSampleRate;
          const newGain = spectastiq.getGainForRegionOfInterest(trackStartZeroOne, trackEndZeroOne, minFreqZeroOne, maxFreqZeroOne);
          spectastiq.setGain(newGain);
        }

      }
      spectastiq.endCustomInteraction();
    } else if (inRegionCreationMode) {
      regionCreationEndX = pointerPositionX;
      regionCreationEndY = pointerPositionY;
      spectastiq.endCustomInteraction();

      const left = Math.min(regionCreationEndX, regionCreationStartX);
      const right = Math.max(regionCreationEndX, regionCreationStartX);
      const top = Math.min(regionCreationEndY, regionCreationStartY);
      const bottom = Math.max(regionCreationEndY, regionCreationStartY);
      const width = canvasCtx.canvas.width;
      const height = canvasCtx.canvas.height;

      const beginRange = selectionRangeStartZeroOne;
      const endRange = selectionRangeEndZeroOne;
      const range = endRange - beginRange;
      const startZeroOne =
        beginRange + Math.max(0, left / (width / devicePixelRatio)) * range;
      const endZeroOne =
        beginRange + Math.min(1, right / (width / devicePixelRatio)) * range;

      const start = startZeroOne * audioDuration;
      const end = endZeroOne * audioDuration;
      const bottomZeroOne = Math.max(0, bottom / (height / devicePixelRatio));
      const topZeroOne = Math.min(1, top / (height / devicePixelRatio));
      const minFreqHz =
        spectastiq.inverseTransformY(bottomZeroOne) * audioSampleRate;
      const maxFreqHz =
        spectastiq.inverseTransformY(topZeroOne) * audioSampleRate;
      // If the box is too small, don't create a region
      if (end - start < 0.01 || maxFreqHz - minFreqHz < 1) {

        return;
      }
      inRegionCreationMode = false;
      const label = prompt("Add a label");
      const newRoi = {
        start,
        end,
        minFreqHz,
        maxFreqHz,
        label: label || "unnamed",
      };
      myRois.push(newRoi);
      spectastiq.exitCustomInteractionMode();
      await selectRegionAndPlay(newRoi, true, true);
      spectastiq.style.cursor = "auto";
    }
  });
  spectastiq.addEventListener(
    "select",
    ({detail: {offsetX: x, offsetY: y}}) => {
      if (inRegionResizeMode) {
        return;
      }
      // Check to see if we're intersecting any of our boxes.
      const begin = selectionRangeStartZeroOne;
      const end = selectionRangeEndZeroOne;
      const cropScaleY = audioSampleRate;
      const duration = audioDuration;
      let bestD = Number.MAX_SAFE_INTEGER;
      let hitRoi;
      for (const roi of myRois) {
        const trackStart = roi.start / duration;
        const trackEnd = roi.end / duration;
        const minFreq = 1 - Math.max(0, roi.minFreqHz) / cropScaleY;
        const maxFreq =
          1 - Math.min(roi.maxFreqHz, cropScaleY) / cropScaleY;

        const hitBox = getTrackBounds(
          canvasCtx.canvas.width / devicePixelRatio,
          canvasCtx.canvas.height / devicePixelRatio,
          begin,
          end,
          [trackStart, maxFreq, trackEnd, minFreq],
        );

        const d = pointIsInPaddedBox(x, y, hitBox);
        if (d !== false && d < bestD && roi !== selectedRoi) {
          bestD = d;
          hitRoi = roi;
        }
      }
      if (hitRoi) {
        selectedRoi = myRois.find(roi => roi === hitRoi);
        selectRegionAndPlay(selectedRoi, true).then(() => {
          // Do nothing
        });
      } else {
        selectedRoi = null;
        spectastiq.pause();
        spectastiq.removePlaybackFrequencyBandPass();
        spectastiq.setGain(1);
        spectastiq.selectRegionOfInterest(0, 1, 0, 1).then(() => {
          // Do nothing
        });
      }
    },
  );

  spectastiq.addEventListener("move", (e) => {
    const x = e.detail.offsetX;
    const y = e.detail.offsetY;
    const container = e.detail.container;
    const begin = selectionRangeStartZeroOne;
    const end = selectionRangeEndZeroOne;
    const cropScaleY = audioSampleRate;
    const cWidth = canvasCtx.canvas.width;
    const cHeight = canvasCtx.canvas.height;
    let hit = false;
    for (const roi of myRois) {
      const trackStart = roi.start / audioDuration;
      const trackEnd = roi.end / audioDuration;
      const minFreq = 1 - Math.max(0, roi.minFreqHz) / cropScaleY;
      const maxFreq = 1 - Math.min(roi.maxFreqHz, cropScaleY) / cropScaleY;
      const hitBox = getTrackBounds(
        cWidth / devicePixelRatio,
        cHeight / devicePixelRatio,
        begin,
        end,
        [trackStart, maxFreq, trackEnd, minFreq],
      );
      if (pointIsInExactBox(x, y, hitBox)) {
        hit = true;
        break;
      }
    }
    if (hit) {
      if (!container.classList.contains("cursor-pointer")) {
        container.classList.add("cursor-pointer");
      }
    } else {
      if (container.classList.contains("cursor-pointer")) {
        container.classList.remove("cursor-pointer");
      }
    }

    if (inRegionResizeMode) {
      pointerPositionX = e.detail.offsetX;
      pointerPositionY = e.detail.offsetY;
      const container = spectastiq;
      const prevFeature = hoveredTrackFeature;
      hoveredTrackFeature = hitTestRegionFeatures();
      if (hoveredTrackFeature !== null) {
        if (hoveredTrackFeature === "whole-track") {
          container.style.cursor = "move";
        } else if (hoveredTrackFeature === "top-left") {
          container.style.cursor = "nw-resize";
        } else if (hoveredTrackFeature === "top-right") {
          container.style.cursor = "ne-resize";
        } else if (hoveredTrackFeature === "bottom-left") {
          container.style.cursor = "sw-resize";
        } else if (hoveredTrackFeature === "bottom-right") {
          container.style.cursor = "se-resize";
        }
      } else {
        container.style.cursor = "auto";
      }
      if (hoveredTrackFeature !== prevFeature) {
        renderOverlay();
      }
    }
  });

  spectastiq.addEventListener(
    "audio-loaded",
    ({detail: {sampleRate, duration}}) => {
      audioSampleRate = sampleRate / 2;
      audioDuration = duration;
      audioIsPlaying = false;
    },
  );

  spectastiq.addEventListener("playback-ended", () => {
    audioIsPlaying = false;
  });
  spectastiq.addEventListener("playback-started", () => {
    audioIsPlaying = true;
  });

  spectastiq.addEventListener("double-click", async ({detail: {audioOffsetZeroOne}}) => {
    if (selectedRoi) {
      const currentTrackEndZeroOne = selectedRoi.end / audioDuration.value;
      if (currentTrackEndZeroOne > audioOffsetZeroOne) {
        await spectastiq.play(audioOffsetZeroOne, currentTrackEndZeroOne);
      } else {
        await spectastiq.play(audioOffsetZeroOne);
      }
    } else {
      await spectastiq.play(audioOffsetZeroOne);
    }
  });

  spectastiq.addEventListener(
    "render",
    ({
       detail: {
         range: {begin, end, min, max},
         context: ctx,
       },
     }) => {
      selectionRangeStartZeroOne = begin;
      selectionRangeEndZeroOne = end;
      canvasCtx = ctx;
      renderOverlay(ctx);
    },
  );

  // Init interaction handlers.
  const playPauseBtn = spectastiq.querySelector(".play-pause");
  const createRoiBtn = spectastiq.querySelector(".create-roi");
  const resizeRoiBtn = spectastiq.querySelector(".resize-roi");
  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", () => {
      if (!audioIsPlaying) {
        spectastiq.play();
      } else {
        spectastiq.pause();
      }
    });
    createRoiBtn.addEventListener("click", () => {
      inRegionCreationMode = !inRegionCreationMode;
      if (inRegionCreationMode) {
        spectastiq.style.cursor = "crosshair";
        spectastiq.enterCustomInteractionMode();
      } else {
        spectastiq.style.cursor = "auto";
        spectastiq.exitCustomInteractionMode();
      }
    });
    resizeRoiBtn.addEventListener("click", () => {
      if (selectedRoi) {
        inRegionResizeMode = !inRegionResizeMode;
        if (inRegionResizeMode) {
          resizeRoiBtn.innerText = "Save changes";
          spectastiq.enterCustomInteractionMode();
        } else {

          resizeRoiBtn.innerText = "Resize";
          spectastiq.exitCustomInteractionMode();
          renderRoiTableView();
          selectRegionAndPlay(selectedRoi, true, false).then(() => {
            // Do nothing
          });
        }
        renderOverlay();
      }
    });
  }

  const renderRoiTableView = () => {
    const table = document.querySelector(".rois");
    if (table) {
      table.classList.toggle("visible", myRois.length !== 0);
      const body = table.querySelector("tbody");
      let rows = "";
      for (const roi of myRois) {
        rows += `
      <tr>
        <td>${roi.label}</td>
        <td>${roi.start.toFixed(2)}s</td>
        <td>${roi.end.toFixed(2)}s</td>
        <td>${(roi.end - roi.start).toFixed(2)}s</td>
        <td>${(roi.minFreqHz / 1000).toFixed(2)}kHz</td>
        <td>${(roi.maxFreqHz / 1000).toFixed(2)}kHz</td>
      </tr>
      `;
      }
      body.innerHTML = rows;
    }
  };
  renderRoiTableView();

}
