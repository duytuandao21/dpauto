type ShaderKind = "logo" | "background";

const vertexSource = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const values: Record<ShaderKind, Record<string, number>> = {
  logo: {
    u_ambient: 0,
    u_angle: 57,
    u_bend: 0.36,
    u_contour: 1,
    u_deflection: 3,
    u_density: 0.02,
    u_dispersion: 0,
    u_distort: 0,
    u_distortSpeed: 1,
    u_edge: 0.53,
    u_exposure: 1.4,
    u_glow: 0.7,
    u_grain: 0,
    u_lineFade: 0,
    u_noiseAmount: 0.5,
    u_noiseScale: 1.5,
    u_offset: 0.21,
    u_saturation: 1.2,
    u_speed: 0.2,
    u_sweepSpeed: 0,
    u_viscosity: 0.79,
  },
  background: {
    u_contrast: 1.1,
    u_distBias: 0,
    u_dither: 0.05,
    u_ditherMode: 0,
    u_exposure: 1.1,
    u_jellify: 0,
    u_loop: 0,
    u_saturation: 1,
    u_scale: 0.44,
    u_seed: 148,
    u_speed: 0.08,
    u_turbAmp: 0.17,
    u_turbFreq: 0.73,
    u_turbIter: 6,
    u_waveFreq: 1.8,
  },
};

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Shader unavailable");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || "Shader compilation failed");
  }
  return shader;
}

// A distance field supplies the bevel depth expected by the reference logo GLSL.
async function logoHeightmap(src?: string) {
  const image = new Image();
  image.src = src ?? "/images/Aoa83BW1jq5HjPbFpH0LRrs0vA.svg";
  await image.decode();
  const width = 1024,
    height = Math.round(
      width * (src ? image.naturalHeight / image.naturalWidth : 108 / 315),
    );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const distance = new Float32Array(width * height);
  let maximum = 0;
  for (let i = 0; i < distance.length; i++)
    distance[i] = pixels[i * 4 + 3] > 127 ? 10000 : 0;
  const diagonal = Math.SQRT2;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!distance[i]) continue;
      let d = distance[i];
      if (x > 0) d = Math.min(d, distance[i - 1] + 1);
      if (y > 0) {
        d = Math.min(d, distance[i - width] + 1);
        if (x > 0) d = Math.min(d, distance[i - width - 1] + diagonal);
        if (x < width - 1) d = Math.min(d, distance[i - width + 1] + diagonal);
      }
      distance[i] = d;
    }
  for (let y = height - 1; y >= 0; y--)
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (!distance[i]) continue;
      let d = distance[i];
      if (x < width - 1) d = Math.min(d, distance[i + 1] + 1);
      if (y < height - 1) {
        d = Math.min(d, distance[i + width] + 1);
        if (x > 0) d = Math.min(d, distance[i + width - 1] + diagonal);
        if (x < width - 1) d = Math.min(d, distance[i + width + 1] + diagonal);
      }
      distance[i] = d;
      maximum = Math.max(maximum, d);
    }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < distance.length; i++) {
    data[i * 4] = Math.round(
      Math.min(1, distance[i] / Math.max(maximum, 1)) * 255,
    );
    data[i * 4 + 1] = 0;
    data[i * 4 + 2] = pixels[i * 4 + 3];
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

export async function createShaderRenderer(
  canvas: HTMLCanvasElement,
  kind: ShaderKind,
  signal: AbortSignal,
  options: { logoSrc?: string; palette?: "red" } = {},
) {
  const gl = canvas.getContext("webgl2", {
    alpha: kind === "logo",
    antialias: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const filename = kind === "logo" ? "logo-spectrum" : "liquid-gradient";
  const response = await fetch(`/effects/${filename}.frag`, { signal });
  if (!response.ok) throw new Error("Shader source unavailable");
  const fragment = await response.text();
  const uniforms = Object.keys(values[kind])
    .map((key) => `uniform float ${key};`)
    .join("\n");
  const extra =
    kind === "logo"
      ? "uniform sampler2D u_image_heightmap; uniform vec4 u_colorBack; uniform vec4 u_baseColor;"
      : "uniform sampler2D u_push_buffer; uniform vec4 u_colors[8]; uniform int u_colors_length; uniform float u_pixelRatio;";
  const fragmentSource = `#version 300 es\nprecision highp float;\nprecision highp int;\nin vec2 v_uv;\nout vec4 fragColor;\nuniform vec2 u_resolution;\nuniform float u_time;\n${uniforms}\n${extra}\n${fragment}`;
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource),
    pixel = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("WebGL program unavailable");
  gl.attachShader(program, vertex);
  gl.attachShader(program, pixel);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) || "Shader linking failed");
  gl.useProgram(program);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  for (const [name, value] of Object.entries(values[kind]))
    gl.uniform1f(uniform(name), value);
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (kind === "logo") {
    const { data, width, height } = await logoHeightmap(options.logoSrc);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    );
    gl.uniform1i(uniform("u_image_heightmap"), 0);
    gl.uniform4f(uniform("u_colorBack"), 0, 0, 0, 0);
    gl.uniform4f(uniform("u_baseColor"), 1, 1, 1, 1);
  } else {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]),
    );
    gl.uniform1i(uniform("u_push_buffer"), 0);
    gl.uniform1i(uniform("u_colors_length"), 3);
    gl.uniform4fv(
      uniform("u_colors[0]"),
      new Float32Array(
        options.palette === "red"
          ? [
              115 / 255,
              0,
              8 / 255,
              1,
              174 / 255,
              9 / 255,
              22 / 255,
              1,
              226 / 255,
              0,
              0,
              1,
            ]
          : [
              21 / 255,
              24 / 255,
              27 / 255,
              1,
              38 / 255,
              38 / 255,
              38 / 255,
              1,
              122 / 255,
              122 / 255,
              122 / 255,
              1,
            ],
      ),
    );
  }
  const resolution = uniform("u_resolution"),
    time = uniform("u_time");
  return {
    draw(seconds: number) {
      if (signal.aborted) return;
      const ratio =
        Math.min(devicePixelRatio, 1.5) * (kind === "background" ? 0.75 : 1);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio)),
        height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.uniform2f(resolution, width, height);
      gl.uniform1f(time, seconds);
      if (kind === "background") gl.uniform1f(uniform("u_pixelRatio"), ratio);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(pixel);
    },
  };
}
