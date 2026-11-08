// Fluid solver adapted from React Bits SplashCursor. See SOURCE.md / LICENSE.md.
import { fragmentHeader, fragmentSources, vertexSource } from './shaders'

export type FluidPoint = { x: number; y: number }
export type FluidRenderer = {
  splat: (from: FluidPoint, to: FluidPoint, dt: number, now: number) => void
  step: (dt: number) => void
  render: () => void
  clear: () => void
  dispose: () => void
}

type Target = {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
  width: number
  height: number
  attach: (unit: number) => number
}
type Pair = { read: Target; write: Target; swap: () => void }
type Program = { handle: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> }
type ProgramName = keyof typeof fragmentSources

const palette = [[0.73, 0.77, 0.63], [0.86, 0.73, 0.48], [0.94, 0.88, 0.73]] as const
const simulationResolution = 96
const dyeResolution = 256
const pressureIterations = 10

/** Unsupported GPUs fall back to the existing static hero without surfacing an error. */
export function createFluidRenderer(canvas: HTMLCanvasElement): FluidRenderer | null {
  try { return initializeRenderer(canvas) } catch { return null }
}

function initializeRenderer(canvas: HTMLCanvasElement): FluidRenderer | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true, premultipliedAlpha: true, antialias: false,
    depth: false, stencil: false, preserveDrawingBuffer: false,
    powerPreference: 'low-power',
  })
  if (!gl) return null
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null

  const textures = new Set<WebGLTexture>()
  const framebuffers = new Set<WebGLFramebuffer>()
  const shaders = new Set<WebGLShader>()
  const programs = new Map<ProgramName, Program>()
  const buffers = new Set<WebGLBuffer>()
  const vertexArrays = new Set<WebGLVertexArrayObject>()
  let disposed = false

  const clearCanvas = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    // Lost contexts have already invalidated their GPU resources.
    if (!gl.isContextLost()) {
      clearCanvas()
      gl.bindVertexArray(null)
      gl.bindBuffer(gl.ARRAY_BUFFER, null)
      gl.useProgram(null)
      for (const texture of textures) gl.deleteTexture(texture)
      for (const framebuffer of framebuffers) gl.deleteFramebuffer(framebuffer)
      for (const shader of shaders) gl.deleteShader(shader)
      for (const program of programs.values()) gl.deleteProgram(program.handle)
      for (const buffer of buffers) gl.deleteBuffer(buffer)
      for (const array of vertexArrays) gl.deleteVertexArray(array)
    }
    textures.clear()
    framebuffers.clear()
    shaders.clear()
    programs.clear()
    buffers.clear()
    vertexArrays.clear()
    // Also release the large default framebuffer while this canvas is inactive.
    canvas.width = 1
    canvas.height = 1
  }

  try {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) throw new Error('Shader unavailable')
      shaders.add(shader)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader unsupported')
      return shader
    }
    const vertex = compile(gl.VERTEX_SHADER, vertexSource)
    for (const name of Object.keys(fragmentSources) as ProgramName[]) {
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentHeader + fragmentSources[name])
      const handle = gl.createProgram()
      if (!handle) throw new Error('Program unavailable')
      const program: Program = { handle, uniforms: {} }
      programs.set(name, program)
      gl.attachShader(handle, vertex)
      gl.attachShader(handle, fragment)
      gl.bindAttribLocation(handle, 0, 'aPosition')
      gl.linkProgram(handle)
      if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new Error('Program unsupported')
      const count: number = gl.getProgramParameter(handle, gl.ACTIVE_UNIFORMS)
      for (let index = 0; index < count; index++) {
        const info = gl.getActiveUniform(handle, index)
        if (info) program.uniforms[info.name] = gl.getUniformLocation(handle, info.name)
      }
      gl.detachShader(handle, vertex)
      gl.detachShader(handle, fragment)
      gl.deleteShader(fragment)
      shaders.delete(fragment)
    }
    gl.deleteShader(vertex)
    shaders.delete(vertex)

    const buffer = gl.createBuffer()
    if (!buffer) throw new Error('Buffer unavailable')
    buffers.add(buffer)
    const vertexArray = gl.createVertexArray()
    if (!vertexArray) throw new Error('Vertex array unavailable')
    vertexArrays.add(vertexArray)
    gl.bindVertexArray(vertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.disable(gl.BLEND)

    // Bound both DPR and the output surface on very large displays.
    const cssWidth = Math.max(canvas.clientWidth, 1)
    const cssHeight = Math.max(canvas.clientHeight, 1)
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5, 1800 / Math.max(cssWidth, cssHeight))
    canvas.width = Math.max(1, Math.round(cssWidth * ratio))
    canvas.height = Math.max(1, Math.round(cssHeight * ratio))
    const aspect = canvas.width / canvas.height
    const resolution = (base: number) => {
      const long = Math.round(base * Math.min(Math.max(aspect, 1 / aspect), 3))
      return aspect > 1 ? [long, base] as const : [base, long] as const
    }

    const createTarget = (width: number, height: number, filter: number): Target => {
      const texture = gl.createTexture()
      if (!texture) throw new Error('Texture unavailable')
      textures.add(texture)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null)
      const framebuffer = gl.createFramebuffer()
      if (!framebuffer) throw new Error('Framebuffer unavailable')
      framebuffers.add(framebuffer)
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Half-float target unsupported')
      gl.viewport(0, 0, width, height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      return {
        texture, framebuffer, width, height,
        attach: (unit) => {
          gl.activeTexture(gl.TEXTURE0 + unit)
          gl.bindTexture(gl.TEXTURE_2D, texture)
          return unit
        },
      }
    }
    const createPair = (width: number, height: number, filter: number): Pair => {
      const pair: Pair = {
        read: createTarget(width, height, filter), write: createTarget(width, height, filter),
        swap: () => { const current = pair.read; pair.read = pair.write; pair.write = current },
      }
      return pair
    }
    const [simWidth, simHeight] = resolution(simulationResolution)
    const [dyeWidth, dyeHeight] = resolution(dyeResolution)
    // Eight fixed targets. No bloom pyramid, particles, or per-event allocation.
    const dye = createPair(dyeWidth, dyeHeight, gl.LINEAR)
    const velocity = createPair(simWidth, simHeight, gl.LINEAR)
    const pressure = createPair(simWidth, simHeight, gl.NEAREST)
    const divergence = createTarget(simWidth, simHeight, gl.NEAREST)
    const curl = createTarget(simWidth, simHeight, gl.NEAREST)
    const texelX = 1 / simWidth
    const texelY = 1 / simHeight
    const bindProgram = (name: ProgramName) => {
      const program = programs.get(name)!
      gl.useProgram(program.handle)
      return program.uniforms
    }
    const blit = (target: Target | null) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null)
      gl.viewport(0, 0, target?.width ?? canvas.width, target?.height ?? canvas.height)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    const clear = () => {
      if (disposed || gl.isContextLost()) return
      // Clear the simulation as well as the screen so waking never revives old ink.
      for (const framebuffer of framebuffers) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
      }
      clearCanvas()
    }
    const splat = (from: FluidPoint, to: FluidPoint, dt: number, now: number) => {
      if (disposed) return
      const distance = Math.hypot((to.x - from.x) * aspect, to.y - from.y)
      if (!distance || distance > 0.35) return
      const radius = 0.0008 * Math.max(aspect, 1)
      const spread = 1 + distance / (1.77 * Math.sqrt(radius))
      const push = 6000 / Math.sqrt(spread)
      const dx = (to.x - from.x) * Math.min(aspect, 1)
      const dy = (to.y - from.y) / Math.max(aspect, 1)
      const u = bindProgram('splat')
      gl.uniform1i(u.uTarget, velocity.read.attach(0))
      gl.uniform1f(u.aspectRatio, aspect)
      gl.uniform2f(u.pointA, from.x, from.y)
      gl.uniform2f(u.pointB, to.x, to.y)
      gl.uniform3f(u.color, dx * push, dy * push, 0)
      gl.uniform1f(u.radius, radius)
      blit(velocity.write)
      velocity.swap()
      const phase = (now / 5200) % palette.length
      const index = Math.floor(phase)
      const fromColor = palette[index]
      const toColor = palette[(index + 1) % palette.length]
      const mix = (phase - index) ** 2 * (3 - 2 * (phase - index))
      const amount = 0.24 * Math.min(dt * 60, 1) / Math.sqrt(spread)
      gl.uniform1i(u.uTarget, dye.read.attach(0))
      gl.uniform3f(u.color,
        (fromColor[0] + (toColor[0] - fromColor[0]) * mix) * amount,
        (fromColor[1] + (toColor[1] - fromColor[1]) * mix) * amount,
        (fromColor[2] + (toColor[2] - fromColor[2]) * mix) * amount)
      blit(dye.write)
      dye.swap()
    }
    const step = (dt: number) => {
      if (disposed) return
      let u = bindProgram('curl')
      gl.uniform2f(u.texelSize, texelX, texelY)
      gl.uniform1i(u.uVelocity, velocity.read.attach(0))
      blit(curl)

      u = bindProgram('vorticity')
      gl.uniform2f(u.texelSize, texelX, texelY)
      gl.uniform1i(u.uVelocity, velocity.read.attach(0))
      gl.uniform1i(u.uCurl, curl.attach(1))
      gl.uniform1f(u.curl, 22)
      gl.uniform1f(u.dt, dt)
      blit(velocity.write)
      velocity.swap()

      u = bindProgram('divergence')
      gl.uniform2f(u.texelSize, texelX, texelY)
      gl.uniform1i(u.uVelocity, velocity.read.attach(0))
      blit(divergence)
      u = bindProgram('clear')
      gl.uniform1i(u.uTexture, pressure.read.attach(0))
      gl.uniform1f(u.value, 0.1)
      blit(pressure.write)
      pressure.swap()

      u = bindProgram('pressure')
      gl.uniform2f(u.texelSize, texelX, texelY)
      gl.uniform1i(u.uDivergence, divergence.attach(0))
      for (let iteration = 0; iteration < pressureIterations; iteration++) {
        gl.uniform1i(u.uPressure, pressure.read.attach(1))
        blit(pressure.write)
        pressure.swap()
      }
      u = bindProgram('gradient')
      gl.uniform2f(u.texelSize, texelX, texelY)
      gl.uniform1i(u.uPressure, pressure.read.attach(0))
      gl.uniform1i(u.uVelocity, velocity.read.attach(1))
      blit(velocity.write)
      velocity.swap()

      u = bindProgram('advection')
      gl.uniform2f(u.texelSize, texelX, texelY)
      gl.uniform1i(u.uVelocity, velocity.read.attach(0))
      gl.uniform1i(u.uSource, velocity.read.attach(0))
      gl.uniform1f(u.dt, dt)
      gl.uniform1f(u.dissipation, 2)
      blit(velocity.write)
      velocity.swap()
      gl.uniform1i(u.uVelocity, velocity.read.attach(0))
      gl.uniform1i(u.uSource, dye.read.attach(1))
      gl.uniform1f(u.dissipation, 3.2)
      blit(dye.write)
      dye.swap()
    }
    const render = () => {
      if (disposed) return
      const u = bindProgram('display')
      gl.uniform1i(u.uTexture, dye.read.attach(0))
      blit(null)
    }
    clearCanvas()
    return { splat, step, render, clear, dispose }
  } catch {
    dispose()
    return null
  }
}
