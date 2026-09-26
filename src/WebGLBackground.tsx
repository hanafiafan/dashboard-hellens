import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createFoliageTexture } from './foliage'
import { createMatSurface } from './matSurface'

const vertexShader = /* glsl */`
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */`
  precision highp float;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uTime;
  uniform sampler2D uFoliage;
  uniform sampler2D uSurface;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    float aspect = uResolution.x / uResolution.y;
    // Match the reference's portrait framing, cropping proportionally on wider screens.
    float referenceAspect = 736.0 / 1308.0;
    vec2 coverage = vec2(min(aspect / referenceAspect, 1.0), min(referenceAspect / aspect, 1.0));
    vec2 canopy = (uv - .5) * coverage + .5;
    // Very small coherent breeze; no detached or falling leaves.
    canopy += vec2(sin(uTime * .17 + uv.y * 2.0), cos(uTime * .13 + uv.x * 2.0)) * .0015;
    float blockedLight = texture2D(uFoliage, canopy).r;
    vec3 pigment = texture2D(uSurface, uv).rgb;
    float grain = hash(floor(gl_FragCoord.xy)) - .5;
    // Ambient fill plus one sun source. Ink and PVC receive the same shadow.
    float daylight = mix(1.46, .69, blockedLight);
    vec3 color = pigment * daylight * vec3(1.035, 1.0, .96);
    color *= 1.0 + grain * .025;
    float edge = smoothstep(.35, .9, distance(uv, vec2(.5)));
    color *= 1.0 - edge * .055;
    gl_FragColor = vec4(color, 1.0);
  }
`
export default function WebGLBackground() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!host.current) return
    const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' }) }
    catch { return }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.current.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.Camera()
    const foliageTexture = createFoliageTexture()
    let surfaceTexture = createMatSurface(host.current.clientWidth, host.current.clientHeight)
    const uniforms = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uFoliage: { value: foliageTexture },
      uSurface: { value: surfaceTexture },
    }
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms })
    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const resize = () => {
      if (!host.current) return
      const { clientWidth, clientHeight } = host.current
      surfaceTexture.dispose()
      surfaceTexture = createMatSurface(clientWidth, clientHeight)
      uniforms.uSurface.value = surfaceTexture
      renderer.setSize(clientWidth, clientHeight, false)
      uniforms.uResolution.value.set(clientWidth * renderer.getPixelRatio(), clientHeight * renderer.getPixelRatio())
      renderer.render(scene, camera)
    }
    const pointer = (event: PointerEvent) => {
      uniforms.uPointer.value.set(event.clientX / innerWidth - .5, .5 - event.clientY / innerHeight)
    }
    let frame = 0
    const start = performance.now()
    const render = (now: number) => {
      uniforms.uTime.value = (now - start) / 1000
      renderer.render(scene, camera)
      if (!prefersReducedMotion) frame = requestAnimationFrame(render)
    }
    resize()
    addEventListener('resize', resize)
    addEventListener('pointermove', pointer, { passive: true })
    frame = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('resize', resize)
      removeEventListener('pointermove', pointer)
      surfaceTexture.dispose(); foliageTexture.dispose(); geometry.dispose(); material.dispose(); renderer.dispose(); renderer.domElement.remove()
    }
  }, [])

  return <div className="webgl-mat" ref={host} aria-hidden="true" />
}
