import {
  MAGMA,
  VIRIDIS,
  PLASMA,
  INFERNO,
  GRAYSCALE,
  GRAYSCALE_SQUARED,
  GRAYSCALE_SQUARED_INVERTED,
  GRAYSCALE_INVERTED
} from "./colormaps.js";

// language=GLSL
const vertexShaderSource = `#version 300 es
in vec4 a_position;
in vec2 a_uv;
uniform highp vec4 u_uv;

mat4 matrix = mat4(
    2.0,  0.0,  0.0,  0.0,
    0.0, -2.0,  0.0,  0.0,
    0.0,  0.0, -1.0,  0.0,
   -1.0,  1.0,  0.0,  1.0
);
out vec2 v_texcoord;

void main() {
  gl_Position = matrix * a_position;
  v_texcoord = a_uv * vec2(1.0, (u_uv.y - u_uv.x)) + vec2(0.0, u_uv.x);
}
`;

// language=GLSL
const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform highp vec4 u_uv;

uniform highp sampler2DArray u_colormap;
uniform highp sampler2DArray u_texture;

uniform highp float u_colormap_index;
uniform highp float u_spectrogram_index;
uniform highp vec3 u_crop_y;

// TODO: Probably need to pass in min/max if we want to clamp to selected tracks.
uniform highp float u_scale;

out vec4 outColor;

float map(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

float flip(float val) {
    return 1.0 - val;
}

float square(float val) {
    return val * val;
}

float cube(float val) {
    return val * val * val;
}

float smoothstop(float val) {
    return flip(square(flip(val)));
}
float smoothstart(float val) {
    return flip(square(val));
}

float my_smoothstep(float val) {
    return 3.0 * square(val) - 2.0 * cube(val); 
}


#define INV_SQRT_OF_2PI 0.39894228040143267793994605993439  // 1.0/SQRT_OF_2PI
#define INV_PI 0.31830988618379067153776752674503
#define INV_LOG_10 0.43429448190325176

//  smartDeNoise - parameters
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
//  sampler2D tex     - sampler image / texture
//  vec2 uv           - actual fragment coord
//  float sigma  >  0 - sigma Standard Deviation
//  float kSigma >= 0 - sigma coefficient 
//      kSigma * sigma  -->  radius of the circular kernel
//  float threshold   - edge sharpening threshold 

vec4 smartDeNoise(sampler2D tex, vec2 uv) {
    float sigma = 5.0;
    float kSigma = 2.0;
    float threshold = 25000.0;
    
    float radius = round(kSigma * sigma);
    float radQ = radius * radius;

    float invSigmaQx2 = .5 / (sigma * sigma);      // 1.0 / (sigma^2 * 2.0)
    float invSigmaQx2PI = INV_PI * invSigmaQx2;    // 1.0 / (sqrt(PI) * sigma)

    float invThresholdSqx2 = .5 / (threshold * threshold);     // 1.0 / (sigma^2 * 2.0)
    float invThresholdSqrt2PI = INV_SQRT_OF_2PI / threshold;   // 1.0 / (sqrt(2*PI) * sigma)

    vec4 centrPx = texture(tex,uv);

    float zBuff = 0.0;
    vec4 aBuff = vec4(0.0);
    vec2 size = vec2(textureSize(tex, 0));

    for (float x = -radius; x <= radius; x++) {
        float pt = sqrt(radQ - x * x);  // pt = yRadius: have circular trend
        for (float y = -pt; y <= pt; y++) {
            vec2 d = vec2(x, y);

            float blurFactor = exp( -dot(d , d) * invSigmaQx2 ) * invSigmaQx2PI;

            vec4 walkPx =  texture(tex, uv + d / size);

            vec4 dC = walkPx-centrPx;
            float deltaFactor = exp( -dot(dC, dC) * invThresholdSqx2) * invThresholdSqrt2PI * blurFactor;

            zBuff += deltaFactor;
            aBuff += deltaFactor * walkPx;
        }
    }
    return aBuff / zBuff;
}


void main() {
    float y = v_texcoord.x;
    float x = v_texcoord.y;

    // How much to crop of the top and bottom of the spectrogram (used if the sample rate of the audio was different
    // from the sample rate the FFT was performed at, since that leaves a blank space at the top) 
    float crop_top = u_crop_y.x;
    float crop_bottom = u_crop_y.y;
    float max_zoom = u_crop_y.z;// Stuff max zoom into this array too.
    float max_y_zoom = max_zoom * 0.8;
    float min_range_y = 1.0 / max_zoom;
    float top = u_uv.z;// 0.2
    float bottom = u_uv.w;// 0.1
    float range_y = top - bottom;
    float clamped_range_y = max(range_y, min_range_y);
    // Prevent divide my zero
    float pos_y = bottom / max(0.000001, (1.0 - range_y));
    float m_max_zoom = map(clamped_range_y, 1.0, min_range_y, 1.0, 1.0 / max_y_zoom);
    float actual_height = clamped_range_y * (1.0 / m_max_zoom);
    float remainder = 1.0 - actual_height;
    float selected_bottom = remainder * pos_y;
    float selected_top = selected_bottom + actual_height;
    //vec4 overlay_debug_color = vec4(0.0, 0.0, 0.0, 0.0);
    bool above_range = y > selected_top;
    bool below_range = y < selected_bottom;
    bool in_range = y <= selected_top && y >= selected_bottom;

    if (in_range) {
        y = map(y, selected_bottom, selected_top, bottom, top);
        
        // BLUE
        //overlay_debug_color = vec4(0.0, 0.0, 1.0, 0.2);
    } else if (below_range) {
        y = map(y, 0.0, selected_bottom, 0.0, bottom);
        
        // GREEN
        //overlay_debug_color = vec4(0.0, 1.0, 0.0, .2);
    } else if (above_range) {
        y = map(y, selected_top, 1.0, top, 1.0);
        
        // RED
        //overlay_debug_color = vec4(1.0, 0.0, 0.0, 0.2);
    }
    
    y = map(y, 0.0, 1.0, crop_top, crop_bottom);
    vec2 texcoord = vec2(y, x);
    
    //vec4 c = smartDeNoise(u_texture, texcoord);
    vec4 c = texture(u_texture, vec3(texcoord.x, texcoord.y, u_spectrogram_index));
    float e = INV_LOG_10 * log(c.r);
    float energyNormalised = e * u_scale;
    float norm = energyNormalised * energyNormalised * energyNormalised * energyNormalised;// * energyNormalised;
    
    // TODO: Mel scale?
    vec3 colorMapVal = texture(u_colormap, vec3(norm, 0.5, u_colormap_index)).rgb;
    //outColor = vec4(mix(colorMapVal, overlay_debug_color.rgb, overlay_debug_color.a), 1.0);
    //outColor = vec4(colorMapVal, 1.0);
    outColor = vec4(colorMapVal, 1.0);
}
`;

const orthographic = (width, height) => {
  return new Float32Array([2, 0, 0, 0, 0, -2, 0, 0, 0, 0, -1, 0, -1, 1, 0, 1]);
};

const translate = (m, tx, ty) => {
  m[12] = m[0] * tx + m[4] * ty + m[12];
  m[13] = m[1] * tx + m[5] * ty + m[13];
  m[14] = m[2] * tx + m[6] * ty + m[14];
  m[15] = m[3] * tx + m[7] * ty + m[15];
};

const scale = (m, sx, sy) => {
  m[0] *= sx;
  m[1] *= sx;
  m[2] *= sx;
  m[3] *= sx;
  m[4] *= sy;
  m[5] *= sy;
  m[6] *= sy;
  m[7] *= sy;
};

// TODO: If there is a long time between swapping from low-res frame to the next hi-res frame, can we cross-fade a blend
//  between the two in our shader?

const texturesForContexts = new Map();
const drawImage = (
  gl,
  program,
  scale,
  left,
  right,
  top,
  bottom,
  cropBottom,
  cropTop,
  spectrogramTextureIndex = 0,
  paletteTextureIndex = 0
) => {
  const texture = texturesForContexts.get(gl);
    // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const textureLocation = gl.getUniformLocation(program, "u_texture");
  const scaleLocation = gl.getUniformLocation(program, "u_scale");
  const colormapIndexLocation = gl.getUniformLocation(
    program,
    "u_colormap_index"
  );
  const spectrogramImageIndexLocation = gl.getUniformLocation(program, "u_spectrogram_index");
  const colormapLocation = gl.getUniformLocation(program, "u_colormap");
  const cropY = gl.getUniformLocation(program, "u_crop_y");
  // We don't really have UV coords like this, they have to come through as vertex array objects.
  const uvCoords = gl.getUniformLocation(program, "u_uv");

  // normalisation scale log10, and log10 constant for doing log10 in shader
  gl.uniform1f(scaleLocation, 1.0 / Math.log10(scale));
  gl.uniform1f(colormapIndexLocation, paletteTextureIndex);
  gl.uniform1f(spectrogramImageIndexLocation, spectrogramTextureIndex);
  gl.uniform1i(colormapLocation, 0);
  gl.uniform1i(textureLocation, 1);
  cropBottom = 1.0 - cropBottom;
  const maxYZoom = texture.texWidth / (gl.canvas.height / window.devicePixelRatio);
  gl.uniform4fv(uvCoords, new Float32Array([left, right, top, bottom]));
  gl.uniform3fv(cropY, new Float32Array([cropTop, cropBottom, maxYZoom]));
  // draw the quad (2 triangles, 6 vertices)
  const offset = 0;
  const count = 6;
  gl.drawArrays(gl.TRIANGLES, offset, count);
};

export const mapRange = (value, min1, max1, min2, max2) => {
  return min2 + ((value - min1) * (max2 - min2)) / (max1 - min1);
};

export const initMainTexture = (gl, texWidth, texHeight) => {
  // Texture array for raw spectrogram textures:
  const hasFloatLinear = !!gl.getExtension("OES_texture_float_linear");
  const texture = gl.createTexture();
  texturesForContexts.set(gl, { texture, texWidth, texHeight });
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (hasFloatLinear) {
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }
  const empty =  new Float32Array(new ArrayBuffer(texWidth * 3 * texHeight * 4))// Dummy data;
  gl.texImage3D(
    gl.TEXTURE_2D_ARRAY,
    0, // mip level
    gl.R32F,
    texWidth,
    texHeight,
    2, // Num slices, could be more in the future if we do more clever things to composite partial frames
    0,
    gl.RED,
    gl.FLOAT,
   empty
  );
  return {texture};
}

export const submitTexture = (gl, index, bitmap, texWidth, texHeight) => {
  let texture;
  if (!texturesForContexts.get(gl)) {
    texture = initMainTexture(gl, texWidth, texHeight);
  } else {
    texture = texturesForContexts.get(gl);
    if (texture.texWidth !== texWidth || texture.texHeight !== texHeight) {
      texture = initMainTexture(gl, texWidth, texHeight);
    }
  }
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture.texture);
  gl.texSubImage3D(
    gl.TEXTURE_2D_ARRAY,
    0, // mip level
    0, // x offset
    0, // y offset
    index,
    texWidth,
    texHeight,
    1,
    gl.RED,
    gl.FLOAT,
    bitmap
  );
};

// TODO: We can put the full range render into the first texture unit, and then double buffer two more?
export const init = (gl) => {
  const hasFloatLinear = !!gl.getExtension("OES_texture_float_linear");
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.compileShader(vertexShader);

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.compileShader(fragmentShader);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  //const colorMapPosition = gl.getUniformLocation(program, 'u_colormap');
  const maps = [
    VIRIDIS,
    PLASMA,
    INFERNO,
    MAGMA,
    GRAYSCALE_INVERTED, // TODO: If we have a light scale, we need to tell the overlay renderer, and the playhead renderer
  ];
  const colorMaps = new Float32Array(maps.flat());
  {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if (hasFloatLinear) {
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    gl.texImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      gl.RGB32F,
      maps[0].length / 3,
      1,
      maps.length,
      0,
      gl.RGB,
      gl.FLOAT,
      colorMaps
    );
  }

  // look up where the vertex data needs to go.
  const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  const uvAttributeLocation = gl.getAttribLocation(program, "a_uv");

  // Create a vertex array object (attribute state)
  const vao = gl.createVertexArray();

  // and make it the one we're currently working with
  gl.bindVertexArray(vao);
  {
    // create the position buffer, make it the current ARRAY_BUFFER
    // and copy in the color values
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Put a unit quad in the buffer
    const positions = new Float32Array([
      0,
      0, // Bottom left
      0,
      1, // Top left
      1,
      0, // Bottom right
      1,
      0, // Bottom right
      0,
      1, // Top left
      1,
      1, // Top right
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Turn on the attribute
    gl.enableVertexAttribArray(positionAttributeLocation);

    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    const size = 2; // 2 components per iteration
    const type = gl.FLOAT; // the data is 32bit floats
    const normalize = false; // don't normalize the data
    const stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
    const offset = 0; // start at the beginning of the buffer
    gl.vertexAttribPointer(
      positionAttributeLocation,
      size,
      type,
      normalize,
      stride,
      offset
    );
  }

  {
    const texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    // Try to remove the zeroth bucket
    const removeZero = 1.0 / 1024.0;

    // https://stackoverflow.com/questions/4364823/how-do-i-obtain-the-frequencies-of-each-value-in-an-fft

    // Put texcoords in the buffer
    const uvs = new Float32Array([
      1,
      0, // Bottom left
      removeZero,
      0, // Top left
      1,
      1, // Bottom right
      1,
      1, // Bottom right
      removeZero,
      0, // Top right
      removeZero,
      1, // Top left
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    // Turn on the attribute
    gl.enableVertexAttribArray(uvAttributeLocation);

    // Tell the attribute how to get data out of texcoordBuffer (ARRAY_BUFFER)
    const size = 2; // 2 components per iteration
    const type = gl.FLOAT; // the data is 32bit floats
    const normalize = true; // convert from 0-255 to 0.0-1.0
    const stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next color
    const offset = 0; // start at the beginning of the buffer
    gl.vertexAttribPointer(
      uvAttributeLocation,
      size,
      type,
      normalize,
      stride,
      offset
    );
    gl.useProgram(program);
  }

  return {
    drawImage: (
      imgIndex,
      scale,
      left,
      right,
      top,
      bottom,
      cropTop,
      cropBottom,
      colorMapIndex
    ) =>
      drawImage(
        gl,
        program,
        scale,
        left,
        right,
        top,
        bottom,
        cropTop,
        cropBottom,
        imgIndex,
        colorMapIndex
      ),
    submitTexture: (index, bitmap, width, height) => submitTexture(gl, index, bitmap, width, height)
  };
  // Unlike images, textures do not have a width and height associated
  // with them so we'll pass in the width and height of the texture
};
