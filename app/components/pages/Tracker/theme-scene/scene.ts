// a theme's world (ThemeScene): sized to the window, drawn at a moment of its own clock (seconds)
export interface Scene {
  resize: (width: number, height: number, dpr: number) => void;
  draw: (time: number) => void;
  dispose: () => void;
}

export type SceneMaker = (back: HTMLCanvasElement) => Scene;

// a full-window fragment shader: its uniforms the size in device pixels (u_res), the clock (u_time) and the device
// pixel ratio (u_dpr)
export function shaderScene (canvas: HTMLCanvasElement, fragment: string): Scene {
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
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, 'attribute vec2 p; void main () { gl_Position = vec4(p, 0.0, 1.0); }'));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `precision highp float;\nuniform vec2 u_res;\nuniform float u_time;\nuniform float u_dpr;\n${fragment}`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'link');
  }
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const res = gl.getUniformLocation(program, 'u_res');
  const time = gl.getUniformLocation(program, 'u_time');
  const dprAt = gl.getUniformLocation(program, 'u_dpr');

  return {
    resize (width, height, dpr) {
      // drawn at most at the device's pixels; a soft world needs no more
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(res, canvas.width, canvas.height);
      gl.uniform1f(dprAt, dpr);
    },
    draw (t) {
      gl.uniform1f(time, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose () {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
