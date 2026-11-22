// a theme's world (ThemeScene): sized to the window, drawn at a moment of its own clock (seconds)
export interface Scene {
  resize: (width: number, height: number, dpr: number) => void;
  draw: (time: number) => void;
  dispose: () => void;
  // a scene drawn over pictures: settles once they've loaded, to be drawn again then (still mode draws no frames)
  ready?: Promise<void>;
  // its ground, for the window to show where a resize uncovers it, if it's far from the palette's paper (Ink's felt)
  ground?: string;
}

export type SceneMaker = (back: HTMLCanvasElement) => Scene;

// a picture a scene is drawn over, fitted to cover the window as CSS's background-size: cover does, held at `anchor`
// (its point kept in view as the window's shape crops it, 0–1 across and down)
export interface ScenePicture {
  src: string;
  anchor?: [number, number];
}

// the part of a picture iw × ih that covers a window w × h, held at its anchor: its left, top, width and height
function cover (iw: number, ih: number, w: number, h: number, [ax, ay]: [number, number]) {
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  return [(iw - sw) * ax, (ih - sh) * ay, sw, sh];
}

// a full-window fragment shader: its uniforms the size in device pixels (u_res), the clock (u_time) and the device
// pixel ratio (u_dpr). A scene whose world mostly holds still can hand its still part over as a second shader (still):
// drawn once a size, into a texture its main shader reads as u_still, so each frame only works out what moves. A scene
// over pictures has each resampled by the browser to the window's own pixels once a size (crisper than the GPU's
// filtering) and read as u_picture0, u_picture1…, at gl_FragCoord.xy / u_res; u_crop maps that onto the first
// picture's own 0–1 coordinates (top down) and u_loaded is 1 once they're all in, 0 before
// drawn into a 2D canvas the window's device size once a size, for the shader to read as u_paint at gl_FragCoord.xy /
// u_res: what's crisper stroked by the browser than worked out per pixel (straight lines, a mesh)
export type ScenePaint = (ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) => void;

export function shaderScene (canvas: HTMLCanvasElement, fragment: string, still?: string, pictures: ScenePicture[] = [], paint?: ScenePaint): Scene {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) {
    throw new Error('no webgl');
  }
  const compile = (type: number, src: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, 'attribute vec2 p; void main () { gl_Position = vec4(p, 0.0, 1.0); }');
  const link = (src: string) => {
    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `precision highp float;\nuniform vec2 u_res;\nuniform float u_time;\nuniform float u_dpr;\nuniform sampler2D u_still;\n${pictures.map((_, i) => `uniform sampler2D u_picture${i};\n`).join('')}${paint ? 'uniform sampler2D u_paint;\n' : ''}uniform vec4 u_crop;\nuniform float u_loaded;\n${src}`));
    gl.bindAttribLocation(program, 0, 'p');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'link');
    }
    return program;
  };
  const program = link(fragment);
  const stillProgram = still ? link(still) : null;
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const sizeUniforms = (p: WebGLProgram, dpr: number) => {
    gl.useProgram(p);
    gl.uniform2f(gl.getUniformLocation(p, 'u_res'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(p, 'u_dpr'), dpr);
  };
  const texture = stillProgram ? gl.createTexture() : null;
  const target = stillProgram ? gl.createFramebuffer() : null;
  gl.useProgram(program);
  const time = gl.getUniformLocation(program, 'u_time');

  const paintTexture = paint ? gl.createTexture() : null;
  // the paint layer's unit, after the pictures'
  const paintUnit = 1 + pictures.length;
  const drawPaint = (dpr: number) => {
    if (!paint) {
      return;
    }
    const scratch = document.createElement('canvas');
    scratch.width = canvas.width;
    scratch.height = canvas.height;
    paint(scratch.getContext('2d')!, canvas.width, canvas.height, dpr);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0 + paintUnit);
    gl.bindTexture(gl.TEXTURE_2D, paintTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, 'u_paint'), paintUnit);
    gl.activeTexture(gl.TEXTURE0);
  };
  const images = pictures.map(() => new Image());
  const textures = pictures.map(() => gl.createTexture());
  let loaded = false;
  let disposed = false;
  const fitPictures = () => {
    if (!loaded || disposed) {
      return;
    }
    const w = canvas.width;
    const h = canvas.height;
    const scratch = document.createElement('canvas');
    scratch.width = w;
    scratch.height = h;
    const ctx = scratch.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    images.forEach((image, i) => {
      const [sx, sy, sw, sh] = cover(image.naturalWidth, image.naturalHeight, w, h, pictures[i].anchor ?? [0.5, 0.5]);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
      gl.activeTexture(gl.TEXTURE1 + i);
      gl.bindTexture(gl.TEXTURE_2D, textures[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(program, `u_picture${i}`), 1 + i);
      if (i === 0) {
        const { naturalWidth: iw, naturalHeight: ih } = image;
        gl.uniform4f(gl.getUniformLocation(program, 'u_crop'), sx / iw, sy / ih, sw / iw, sh / ih);
      }
    });
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(gl.getUniformLocation(program, 'u_loaded'), 1);
  };
  const ready = pictures.length
    ? Promise.all(images.map((image, i) => {
      image.src = pictures[i].src;
      return image.decode();
    })).then(() => {
      loaded = true;
      gl.useProgram(program);
      fitPictures();
    })
    : undefined;

  return {
    resize (width, height, dpr) {
      // drawn at most at the device's pixels; a soft world needs no more
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (stillProgram) {
        // the still part, once, into its texture at the window's size
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        // unbound while it's drawn into, then left bound for the main shader to read
        gl.bindTexture(gl.TEXTURE_2D, null);
        sizeUniforms(stillProgram, dpr);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, texture);
      }
      sizeUniforms(program, dpr);
      fitPictures();
      drawPaint(dpr);
    },
    draw (t) {
      if (disposed) {
        return;
      }
      gl.uniform1f(time, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    ready,
    dispose () {
      disposed = true;
      textures.forEach((texture) => gl.deleteTexture(texture));
      gl.deleteTexture(paintTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      if (stillProgram) {
        gl.deleteProgram(stillProgram);
        gl.deleteTexture(texture);
        gl.deleteFramebuffer(target);
      }
    },
  };
}
