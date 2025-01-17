const map = (value, min1, max1, min2, max2) => {
  //if (min1 !== max1) {
    return min2 + ((value - min1) * (max2 - min2)) / (max1 - min1);
  // }
  // return min2 + ((value - min1) * (max2 - min2));

};
const canvas = document.getElementById("canvas");
const canvas0 = document.getElementById("canvas0");
const text = document.getElementById("text");
const TEXTURE_HEIGHT = 1024;
const CANVAS_HEIGHT = canvas.height;
const cropBottom = 0.9111328125;

const render = (top, bottom, print = false) => {
  const cropTop = 0;
  const initialTop = top;
  const initialBottom = bottom;
  const ctx = canvas.getContext("2d");
  const ctx0 = canvas0.getContext("2d");
  const offscreenCtx = offscreenCanvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // {
  //   const MAX_ZOOMED_REGION = 0.8;
  //   const maxYZoom = (TEXTURE_HEIGHT / CANVAS_HEIGHT) * MAX_ZOOMED_REGION;
  //   const minRangeY = 1 / (TEXTURE_HEIGHT / CANVAS_HEIGHT);
  //   console.log("in range", top - bottom);
  //
  //   const rangeY = Math.max(top - bottom, minRangeY);
  //
  //
  //   const centerI = bottom + (rangeY * 0.5);
  //   const clampedRangeY = Math.max(rangeY, minRangeY);
  //   // const top = centerI + clampedRangeY * (1-centerI);
  //   // const bottom = centerI - clampedRangeY * centerI;
  //
  //   const b = Math.max(0, centerI - (clampedRangeY * 0.5));
  //   const t = bottom + clampedRangeY;
  //   console.log("new top", t);
  //
  //   console.log("new bottom", b);
  //   console.log("centerI", centerI);
  //   console.log("clamped in range", rangeY);
  //   const mMaxZoom = map(rangeY, 1, minRangeY, 1, 1 / maxYZoom);
  //   const actualHeight = clampedRangeY * (1 / mMaxZoom);
  //   console.log("out range", actualHeight);
  // }
  transformY(0, top, bottom, cropTop, cropBottom, false, true);

  for (let y = 0; y < canvas.height; y++) {
    let yy = 1 - (y / canvas.height);
    {
      let {y: ty, tint} = transformY(yy, 1, 0, cropTop, cropBottom, false, print);
      const c = offscreenCtx.getImageData(0, Math.round(ty * TEXTURE_HEIGHT - 1), 1, 1).data;
      for (let x = 0; x < 50; x++) {
        ctx.fillStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
        ctx.fillRect(x, y, 1, 1);
        ctx.fillStyle = tint;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    {
      for (let x = 50; x < canvas.width - 50; x++) {
        const t = map(x, 50, canvas.width - 50, 0, 1);
        const ltop = lerp(1, top, t);
        const lbottom = lerp(0, bottom, t);

        let {y: ty, tint} = transformY(yy, ltop, lbottom, cropTop, cropBottom, false);
        const c = offscreenCtx.getImageData(0, Math.round(ty * TEXTURE_HEIGHT - 1), 1, 1).data;

        ctx.fillStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
        ctx.fillRect(x, y, 1, 1);
        ctx.fillStyle = tint;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    let {y: ty, tint} = transformY(yy, top, bottom, cropTop, cropBottom, false);
    {
      const c = offscreenCtx.getImageData(0, Math.round(ty * TEXTURE_HEIGHT - 1), 1, 1).data;

      for (let x = canvas.width - 50; x < canvas.width; x++) {
        ctx.fillStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
        ctx.fillRect(x, y, 1, 1);
        ctx.fillStyle = tint;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  // {
  //     for (let x = 50; x < canvas.width - 50; x++) {
  //         const ltop = lerp(1, top, x / 50);
  //         const lbottom = lerp(0, bottom, x/50);
  //
  //         let {y: ty} = transformY(1, ltop, lbottom, cropTop, cropBottom);
  //
  //         ctx.fillStyle = `white`;
  //         ctx.fillRect(x, ty * canvas.height, 1, 1);
  //
  //         let {y: by } = transformY(0, ltop, lbottom, cropTop, cropBottom);
  //
  //         ctx.fillStyle = `white`;
  //         ctx.fillRect(x, by * canvas.height, 1, 1);
  //     }
  // }

  /*
  {
    //INITIAL TOP
    {

      const topInY = canvas.height * (1 - transformY(initialTop, 1, 0, 0, 1).y);
      console.log("Draw initial top at", initialTop, topInY);
      ctx.fillStyle = 'green';
      ctx.fillRect(0, topInY - 1, canvas.width / 2, 1);
    }

    //INITIAL BOTTOM
    {
      const bottomInY = canvas.height * (1 - transformY(initialBottom, 1, 0, 0, 1).y);
      ctx.fillStyle = 'orange';
      ctx.fillRect(0, bottomInY, canvas.width / 2, 1);
    }
  }
   */
  const topInY = canvas.height * (1-transformY(top, 1, 0, 0, 1, true).y);
  const bottomInY = canvas.height * (1-transformY(bottom, 1, 0, 0, 1, true).y);
  //TOP
  ctx.fillStyle = 'red';
  ctx.fillRect(0, topInY, 50, 1);

  //BOTTOM
  ctx.fillStyle = 'yellow';
  ctx.fillRect(0, bottomInY, 50, 1);

  for (let x = 50; x < canvas.width - 50; x++) {
    const t = map(x, 50, canvas.width - 50, 0, 1);
    const ltop = lerp(1, top, t);
    const lbottom = lerp(0, bottom, t);

    const topInY = canvas.height * (1 - transformY(top, ltop, lbottom, 0, 1).y);
    const bottomInY = canvas.height * (1 - transformY(bottom, ltop, lbottom, 0, 1).y);
    //console.log(ltop, lbottom, (1-transformY(top, ltop, lbottom, 0, 1).y), (1-transformY(bottom, ltop, lbottom, 0, 1).y));

    ctx.fillStyle = 'red';
    ctx.fillRect(x, topInY, 1, 1);

    //BOTTOM
    ctx.fillStyle = 'yellow';
    ctx.fillRect(x, bottomInY, 1, 1);
  }

  const topOutY = canvas.height * (1-transformY(top, top, bottom, 0, 1).y);
  const bottomOutY = canvas.height * (1-transformY(bottom, top, bottom, 0, 1).y);

  //TOP
  ctx.fillStyle = 'red';
  ctx.fillRect(canvas.width - 50, topOutY, 50, 1);

  //BOTTOM
  ctx.fillStyle = 'yellow';
  ctx.fillRect(canvas.width - 50, bottomOutY, 50, 1);

  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  for (let x = 0; x < canvas.width /50; x++) {
    ctx.fillRect(x * 50, 0, 1, canvas.height);
  }

  {
    for (let y = 0; y < canvas0.height; y++) {
      const yy = y / canvas0.height;
      let {y: ty, tint} = transformY(yy, 1, 0, 1, 0);
      let c;
      try {
        c = offscreenCtx.getImageData(0, Math.round(ty * TEXTURE_HEIGHT - 1), 1, 1).data;
      } catch (e) {
        debugger;
      }
      ctx0.fillStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
      ctx0.fillRect(0, y, 50, 1);
    }
    ctx0.fillStyle = "green";
    ctx0.fillRect(0, 1-initialTop * canvas0.height, 50, 1);

    ctx0.fillStyle = "orange";
    ctx0.fillRect(0, 1-initialBottom * canvas0.height, 50, 1);
  }
  {
    const cc = document.getElementById("canvas00");
    const ctx = cc.getContext("2d");
    ctx.clearRect(0, 0, cc.width, cc.height);
    for (let x = 0; x < cc.width; x++) {
      const c = offscreenCtx.getImageData(0, x, 1, 1).data;
      for (let y = 0; y < cc.height; y++) {
        ctx.fillStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  // ctx.fillStyle = 'blue';
  // ctx.fillRect(0, top * cropBottom * canvas.height, canvas.width, 1);
  //
  // ctx.fillStyle = 'blue';
  // ctx.fillRect(0, bottom * cropBottom * canvas.height, canvas.width, 1);

};


const lerp = (s, e, t) => {
  return s + (e - s) * t;
};
const transformY = (y, top, bottom, cropTop, cropBottom, invert = true, print = false) => {
  const MAX_ZOOMED_REGION = 0.8;
  const maxYZoom = (TEXTURE_HEIGHT / 300) * MAX_ZOOMED_REGION; //2.73066667
  const rangeY = top - bottom;
  const minRangeY = 1 / (TEXTURE_HEIGHT / 300); // 0.2929
  print && console.log("minRangeY", minRangeY);
  const clampedRangeY = Math.max(rangeY, minRangeY);
  print && console.log("clampedRangeY", clampedRangeY);
  const mMaxZoom = map(clampedRangeY, 1, minRangeY, 1, 1 / maxYZoom);
  print && console.log("maxYZoom", maxYZoom);
  const actualHeight = clampedRangeY * (1 / mMaxZoom);
  const posY = bottom / (1-rangeY);
  print && console.log("actualHeight", actualHeight);
  const remainder = 1 - actualHeight;
  print && console.log("remainder", remainder);
  const selectedBottom = posY * remainder;
  const selectedTop = selectedBottom + actualHeight;
  print && console.log("selectedBottom", selectedBottom);
  print && console.log("selectedTop", selectedTop);
  const aboveRange = y > selectedTop;
  const belowRange = y < selectedBottom;
  const inRange = y <= selectedTop && y >= selectedBottom;
  let tint;
  if (inRange) {
    // RED
    if (invert) {
      y = map(y, bottom, top, selectedBottom, selectedTop);
    } else {
      y = map(y, selectedBottom, selectedTop, bottom, top);
    }
    tint = `rgba(255, 0, 0, 0.1)`;
  } else if (belowRange) {
    // GREEN
    if (invert) {
      y = map(y, bottom, top, selectedBottom, selectedTop);
    } else {
      y = map(y, 0, selectedBottom, 0, bottom);
    }
    tint = `rgba(0, 255, 0, 0.1)`;
  } else if (aboveRange) {
    // BLUE
    if (invert) {
      y = map(y, bottom, top, selectedBottom, selectedTop);
    } else {
      y = map(y, selectedTop, 1.0, top, 1.0);
    }
    tint = `rgba(0, 0, 255, 0.1)`;
  }
  y = map(y, 0.0, 1.0, cropTop, cropBottom);
  return {y, tint };
};


const log = (args, line, col) => {
  text.innerHTML += `${line}:\t ${args.join(" ")}\n`;
};

const oldLog = console.log;
console.log = (...args) => {
  const e = new Error();
  const trace = e.stack.split("\n")[1].split(":");
  const col = trace.pop();
  const line = trace.pop();
  log(args, line, col);
  oldLog(...args);
};
const clear = () => text.innerHTML = "";
const offscreenCanvas = new OffscreenCanvas(1, TEXTURE_HEIGHT);
const main = () => {

  // Let's make a sample texture
  const offscreenCtx = offscreenCanvas.getContext('2d');
  for (let y = 0; y < TEXTURE_HEIGHT; y++) {
    if (y < Math.round(TEXTURE_HEIGHT * cropBottom)) {
      let c = 1 - y / Math.round(TEXTURE_HEIGHT * cropBottom);
      offscreenCtx.fillStyle = `rgb(${c * 255}, ${c * 255}, ${c * 255})`;
    } else {
      offscreenCtx.fillStyle = 'red';
    }
    offscreenCtx.fillRect(0, y, 1, 1);
    if (y % 100 === 0) {
      offscreenCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      offscreenCtx.fillRect(0, y, 1, 1);
    }
  }

  const centerSlider = document.getElementById("center");
  const widthSlider = document.getElementById("width");

  let center = parseInt(centerSlider.value) / 100;
  let width = parseInt(widthSlider.value) / 100;

  let bottom = center - width * 0.5;//0.6435593705293277;
  let top = center + width * 0.5;//0.9595307582260372;
  //let top = 0.3564406294706724;
  //let bottom = 0.04046924177396281;
  const redraw = () => {
    bottom = Math.max(0, center - width * 0.5);//0.6435593705293277;
    top = Math.min(1, center + width * 0.5);//0.9595307582260372;
    clear();
    console.log("top", top, "bottom", bottom, "center", center, "width", width);
    render(top, bottom);
  };

  centerSlider.addEventListener('input', (e) => {
    center = parseInt(e.target.value) / 100;
    redraw();
  });
  widthSlider.addEventListener('input', (e) => {
    width = Math.max(0.01, parseInt(e.target.value) / 100);
    redraw();
  });
  redraw();

  // top = Math.max(
  //   0.0,
  //   map(Math.min(1.0, top), 0.0, 1.0, cropTop, cropBottom)
  // );
  // bottom = Math.min(
  //   1.0,
  //   map(Math.max(0.0, bottom), 0.0, 1.0, cropTop, cropBottom)
  // );

  // 0.6435593705293277 0.9595307582260372
  // webgl-drawimage.js?t=1733435270855:288 t,b 2 0.5863680592811159 0.8742599584227467

  //0.5863680592811159 0.8742599584227467

};
main();

//0.99935 0.053950000000000005 5.8467320952014905
//0.9993 0.05810000000000001 45.17761930246418
// debugger;

//console.log(transformY(0.5, 0.9, 0.7, 0, 1, true).y);
//console.log(transformY(1, 0.9595307582260372, 0.6435593705293277, 0, 1, true).y);
//console.log(transformY(0, 0.9595307582260372, 0.6435593705293277, 0, 1, true).y);
//console.log(transformY(0.9595307582260372, 0.9595307582260372, 0.6435593705293277, 0, 1, true).y);
//console.log(transformY(0.9595307582260372, 0.9595307582260372, 0.6435593705293277, 0, 1, true).y);
//  let bottom = 0.6435593705293277;
//   let top = 0.9595307582260372;
//console.log(map(1/maxYZoom, 0.8, 1 / maxYZoom, 1, maxYZoom));
