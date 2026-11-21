// a theme's world (ThemeScene): sized to the window, drawn at a moment of its own clock (seconds)
export interface Scene {
  resize: (width: number, height: number, dpr: number) => void;
  draw: (time: number) => void;
  dispose: () => void;
}

export type SceneMaker = (back: HTMLCanvasElement) => Scene;

// a full-window fragment shader: its uniforms the size in device pixels (u_res), the clock (u_time) and the device
// pixel ratio (u_dpr). A scene whose world mostly holds still can hand its still part over as a second shader (still):
// drawn once a size, into a texture its main shader reads as u_still, so each frame only works out what moves
export function shaderScene (canvas: HTMLCanvasElement, fragment: string, still?: string): Scene {
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
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `precision highp float;\nuniform vec2 u_res;\nuniform float u_time;\nuniform float u_dpr;\nuniform sampler2D u_still;\n${src}`));
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
    },
    draw (t) {
      gl.uniform1f(time, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose () {
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
