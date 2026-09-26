import { useEffect, useRef } from 'react'
import * as T from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createMatSurface } from './matSurface'
import { createFoliageTexture } from './foliage'

interface DeskObjectsProps {
  onSelectProp?: (modalKey: 'projects' | 'about' | 'skills' | 'contact') => void
  mousePos?: { x: number; y: number }
}

export default function DeskObjects({ onSelectProp, mousePos }: DeskObjectsProps) {
  const host = useRef<HTMLDivElement>(null)
  const onSelectRef = useRef(onSelectProp)
  onSelectRef.current = onSelectProp

  const mousePosRef = useRef(mousePos || { x: 0, y: 0 })
  mousePosRef.current = mousePos || { x: 0, y: 0 }

  useEffect(() => {
    const container = host.current!
    let renderer: T.WebGLRenderer
    try {
      renderer = new T.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      })
    } catch {
      return
    }

    renderer.setPixelRatio(Math.min(devicePixelRatio, 2.0))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = T.PCFSoftShadowMap
    renderer.outputColorSpace = T.SRGBColorSpace
    renderer.toneMapping = T.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.06
    container.appendChild(renderer.domElement)

    const scene = new T.Scene()

    // 1. Studio PMREM Environment for tactile PBR reflections
    const pmrem = new T.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const environment = pmrem.fromScene(room, 0.04)
    scene.environment = environment.texture
    scene.environmentIntensity = 0.95
    room.dispose()
    pmrem.dispose()

    // 2. Camera Setup: Cinematic Tilted Perspective for true 3D Depth
    // A 32-degree perspective camera tilted at ~12 degrees gives realistic volume & bevel highlights
    const camera = new T.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, -2.6, 17.5)
    camera.lookAt(0, 0.3, 0)

    // 3. Disney / Blender 3D Studio Three-Point Lighting Setup
    // Key Sun: Warm golden sunlight from upper-left
    const sun = new T.DirectionalLight(0xfff6e8, 3.8)
    sun.position.set(-13, 16, 18)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 0.1, far: 50 })
    sun.shadow.normalBias = 0.02
    sun.shadow.bias = -0.0004
    sun.shadow.radius = 4.2
    scene.add(sun)

    // Ambient & Hemisphere Sky Light
    scene.add(new T.AmbientLight(0xffffff, 0.25))
    scene.add(new T.HemisphereLight(0xdcf0ff, 0x182c20, 0.72))

    // Crisp Blue Rim Light from upper-right (Pixar silhouette glint)
    const rimLight = new T.PointLight(0x70b8ff, 80, 50)
    rimLight.position.set(13, 10, 8)
    scene.add(rimLight)

    // Warm Studio Bounce Light from bottom-left
    const warmBounce = new T.PointLight(0xffaa50, 45, 40)
    warmBounce.position.set(-11, -12, 6)
    scene.add(warmBounce)

    // Soft Overhead Fill Light
    const topFill = new T.PointLight(0xffffff, 25, 35)
    topFill.position.set(0, 0.5, 12)
    scene.add(topFill)

    // 4. Cutting Mat Floor
    const surfaceMaterial = new T.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.88,
      metalness: 0.02
    })
    const floor = new T.Mesh(new T.PlaneGeometry(1, 1), surfaceMaterial)
    floor.position.z = -0.02
    floor.receiveShadow = true
    scene.add(floor)

    // 5. Canopy Dappled Sunlight Foliage
    const canopyTexture = createFoliageTexture()
    const sceneExtent = { value: new T.Vector2(16, 10) }
    const patchedMaterials = new WeakSet<T.Material>()

    const unifyLight = (root: T.Object3D) => root.traverse(object => {
      if (!(object instanceof T.Mesh)) return
      for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(mat instanceof T.MeshStandardMaterial) || patchedMaterials.has(mat)) continue
        patchedMaterials.add(mat)
        mat.onBeforeCompile = shader => {
          shader.uniforms.deskCanopy = { value: canopyTexture }
          shader.uniforms.deskExtent = sceneExtent
          shader.vertexShader = 'varying vec3 vDeskWorld;\n' + shader.vertexShader
          shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            '#include <worldpos_vertex>\nvDeskWorld=(modelMatrix*vec4(transformed,1.0)).xyz;'
          )
          shader.fragmentShader = 'uniform sampler2D deskCanopy;\nuniform vec2 deskExtent;\nvarying vec3 vDeskWorld;\n' + shader.fragmentShader
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <opaque_fragment>',
            `
            vec2 deskUV = vDeskWorld.xy / deskExtent + 0.5;
            float deskAspect = deskExtent.x / deskExtent.y;
            vec2 cover = vec2(min(deskAspect / 0.5627, 1.0), min(0.5627 / deskAspect, 1.0));
            vec2 canopyUV = (deskUV - 0.5) * cover + 0.5;
            canopyUV += vec2(0.018, -0.025) * vDeskWorld.z;
            float shade = texture2D(deskCanopy, canopyUV).r;
            outgoingLight *= mix(vec3(1.10, 1.055, 0.98), vec3(0.58, 0.65, 0.68), shade);
            #include <opaque_fragment>
            `
          )
        }
        mat.customProgramCacheKey = () => 'desk-world-canopy-v3'
        mat.needsUpdate = true
      }
    })

    // Surface relief grain
    const grainCanvas = document.createElement('canvas')
    grainCanvas.width = grainCanvas.height = 256
    const grainCtx = grainCanvas.getContext('2d')!
    const grainData = grainCtx.createImageData(256, 256)
    let grainSeed = 42
    for (let i = 0; i < grainData.data.length; i += 4) {
      grainSeed = (grainSeed * 1664525 + 1013904223) >>> 0
      const v = 115 + (grainSeed % 32)
      grainData.data.set([v, v, v, 255], i)
    }
    grainCtx.putImageData(grainData, 0, 0)
    const grainMap = new T.CanvasTexture(grainCanvas)
    grainMap.wrapS = grainMap.wrapT = T.RepeatWrapping
    grainMap.repeat.set(6, 6)
    surfaceMaterial.bumpMap = grainMap
    surfaceMaterial.bumpScale = 0.0025

    // Helper material factory
    const material = (color: T.ColorRepresentation, metalness = 0, roughness = 0.55, clearcoat = 0.2) =>
      new T.MeshPhysicalMaterial({
        color,
        metalness,
        roughness,
        clearcoat,
        clearcoatRoughness: 0.15,
        bumpMap: grainMap,
        bumpScale: metalness > 0.5 ? 0.002 : 0.005
      })

    const plasticDark = material('#1b1e22', 0.05, 0.55, 0.3)
    const plasticWhite = material('#f8f9fa', 0.02, 0.45, 0.4)
    const aluminumSilver = material('#d0d6dc', 0.85, 0.22, 0.4)
    const chromeMetal = material('#e8ecf0', 0.98, 0.12, 0.8)
    const brassGold = material('#dfb342', 0.92, 0.25, 0.6)
    const warmPaper = material('#fbf8f0', 0, 0.92, 0)
    const canaryYellow = material('#ffd54f', 0, 0.78, 0.1)
    const neonOrange = material('#ff5722', 0.02, 0.45, 0.5)

    const addMesh = (group: T.Group, geometry: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0) => {
      const mesh = new T.Mesh(geometry, mat)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
      return mesh
    }

    // Beveled rounded box generator for Pixar / Blender 3D tactile aesthetics
    const box = (g: T.Group, w: number, h: number, d: number, m: T.Material, x = 0, y = 0, z = 0, r = 0.08) => {
      const radius = Math.min(r, w / 2 - 0.001, h / 2 - 0.001)
      const a = -w / 2, b = -h / 2
      const shape = new T.Shape()
      shape.moveTo(a + radius, b)
      shape.lineTo(a + w - radius, b)
      shape.quadraticCurveTo(a + w, b, a + w, b + radius)
      shape.lineTo(a + w, b + h - radius)
      shape.quadraticCurveTo(a + w, b + h, a + w - radius, b + h)
      shape.lineTo(a + radius, b + h)
      shape.quadraticCurveTo(a, b + h, a, b + h - radius)
      shape.lineTo(a, b + radius)
      shape.quadraticCurveTo(a, b, a + radius, b)
      const bevel = Math.min(d * 0.2, 0.025)
      const geo = new T.ExtrudeGeometry(shape, {
        depth: Math.max(0.005, d - 2 * bevel),
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: Math.min(bevel, radius * 0.35),
        bevelSegments: 4,
        steps: 1,
        curveSegments: 12
      })
      geo.translate(0, 0, -d / 2 + bevel)
      return addMesh(g, geo, m, x, y, z)
    }

    // Interactive clickable objects registry
    const clickableObjects: { mesh: T.Object3D; key: 'projects' | 'about' | 'skills' | 'contact'; originalScale: number }[] = []

    // =========================================================================
    // CENTRAL 3D TITLE PAPERS (Real 3D Extruded Paper Sheets with Bevels & Depth)
    // =========================================================================
    const centerTitleGroup = new T.Group()
    scene.add(centerTitleGroup)

    const createTitlePaper = (
      w: number,
      h: number,
      d: number,
      canvasDraw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
    ) => {
      const pGroup = new T.Group()
      // 3D paper backing with real thickness and beveled edge
      box(pGroup, w, h, d, warmPaper, 0, 0, d / 2, 0.04)

      // High-resolution canvas texture for crisp vector-like typography
      const c = document.createElement('canvas')
      c.width = 1536
      c.height = Math.round(1536 * (h / w))
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#faf8f2'
      ctx.fillRect(0, 0, c.width, c.height)

      // Grid paper lines
      ctx.strokeStyle = 'rgba(60, 90, 80, 0.12)'
      ctx.lineWidth = 2.0
      const step = 36
      for (let x = 0; x < c.width; x += step) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, c.height)
      }
      for (let y = 0; y < c.height; y += step) {
        ctx.moveTo(0, y)
        ctx.lineTo(c.width, y)
      }
      ctx.stroke()

      canvasDraw(ctx, c.width, c.height)

      const tex = new T.CanvasTexture(c)
      tex.colorSpace = T.SRGBColorSpace
      addMesh(
        pGroup,
        new T.PlaneGeometry(w * 0.99, h * 0.99),
        new T.MeshStandardMaterial({ map: tex, roughness: 0.88 }),
        0,
        0,
        d + 0.005
      )
      return pGroup
    }

    // 1. "HELLENS ✳" 3D Paper Cutout
    const paperHellens = createTitlePaper(3.4, 0.92, 0.035, (ctx, cw, ch) => {
      ctx.fillStyle = '#121815'
      ctx.font = '900 180px "Outfit", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('HELLENS', cw * 0.44, ch * 0.52)
      ctx.fillStyle = '#e8592c'
      ctx.fillText('✳', cw * 0.84, ch * 0.52)
    })
    paperHellens.position.set(-1.1, 1.45, 0.08)
    paperHellens.rotation.z = -0.055
    paperHellens.userData = { key: 'about' }
    clickableObjects.push({ mesh: paperHellens, key: 'about', originalScale: 1.0 })
    centerTitleGroup.add(paperHellens)

    // 2. "Dashboard" 3D Paper Cutout
    const paperDashboard = createTitlePaper(7.4, 2.2, 0.045, (ctx, cw, ch) => {
      // Coral highlighter brush stroke under text
      ctx.fillStyle = 'rgba(232, 89, 44, 0.65)'
      ctx.fillRect(cw * 0.05, ch * 0.78, cw * 0.90, 42)

      // Italic display serif font
      ctx.font = 'italic 700 240px "Newsreader", Georgia, serif'
      ctx.fillStyle = '#121815'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Dashboard', cw * 0.5, ch * 0.46)
    })
    paperDashboard.position.set(0, 0.2, 0.05)
    paperDashboard.rotation.z = -0.008
    paperDashboard.userData = { key: 'projects' }
    clickableObjects.push({ mesh: paperDashboard, key: 'projects', originalScale: 1.0 })
    centerTitleGroup.add(paperDashboard)

    // 3. "Portfolio." 3D Paper Cutout
    const paperPortfolio = createTitlePaper(4.8, 1.35, 0.04, (ctx, cw, ch) => {
      ctx.fillStyle = '#121815'
      ctx.font = '900 210px "Outfit", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Portfolio', cw * 0.44, ch * 0.52)
      ctx.fillStyle = '#e8592c'
      ctx.beginPath()
      ctx.arc(cw * 0.84, ch * 0.65, 18, 0, Math.PI * 2)
      ctx.fill()
    })
    paperPortfolio.position.set(1.4, -1.05, 0.09)
    paperPortfolio.rotation.z = 0.03
    paperPortfolio.userData = { key: 'contact' }
    clickableObjects.push({ mesh: paperPortfolio, key: 'contact', originalScale: 1.0 })
    centerTitleGroup.add(paperPortfolio)

    // Frosted 3D Scotch Tape Strips on Dashboard paper
    const tapeMat = new T.MeshPhysicalMaterial({
      color: '#ffffff',
      transmission: 0.88,
      opacity: 0.82,
      transparent: true,
      roughness: 0.35,
      ior: 1.45,
      clearcoat: 0.8
    })

    const makeTape = (x: number, y: number, z: number, rotZ: number) => {
      const tape = addMesh(centerTitleGroup, new T.BoxGeometry(0.85, 0.35, 0.015), tapeMat, x, y, z)
      tape.rotation.z = rotZ
      return tape
    }
    makeTape(-3.2, 1.25, 0.11, -0.15)
    makeTape(3.2, -0.85, 0.11, 0.12)
    makeTape(-0.2, 1.32, 0.11, 0.05)

    // Chalk Kicker right above HELLENS
    const kickerCanvas = document.createElement('canvas')
    kickerCanvas.width = 1024
    kickerCanvas.height = 256
    const kCtx = kickerCanvas.getContext('2d')!
    kCtx.fillStyle = 'rgba(0,0,0,0)'
    kCtx.clearRect(0, 0, 1024, 256)

    kCtx.font = 'bold 44px "Space Mono", monospace'
    kCtx.fillStyle = 'rgba(215, 240, 222, 0.85)'
    kCtx.fillText('A LITTLE DATA. A LOT OF CLARITY. ↗', 40, 150)

    const kickerTex = new T.CanvasTexture(kickerCanvas)
    kickerTex.colorSpace = T.SRGBColorSpace
    const kickerMesh = addMesh(
      centerTitleGroup,
      new T.PlaneGeometry(6.2, 1.55),
      new T.MeshStandardMaterial({ map: kickerTex, transparent: true, roughness: 0.95 }),
      0.6,
      2.55,
      0.01
    )
    kickerMesh.rotation.z = -0.04

    // Chalk Caption right below Portfolio
    const captionCanvas = document.createElement('canvas')
    captionCanvas.width = 1024
    captionCanvas.height = 256
    const capCtx = captionCanvas.getContext('2d')!
    capCtx.fillStyle = 'rgba(0,0,0,0)'
    capCtx.clearRect(0, 0, 1024, 256)

    capCtx.font = '500 58px "Caveat", cursive'
    capCtx.fillStyle = 'rgba(215, 240, 222, 0.88)'
    capCtx.textAlign = 'center'
    capCtx.fillText('Thoughtfully arranged. Clearly understood.', 512, 120)
    // Chalk underline
    capCtx.strokeStyle = 'rgba(215, 240, 222, 0.65)'
    capCtx.lineWidth = 4
    capCtx.beginPath()
    capCtx.moveTo(120, 160)
    capCtx.quadraticCurveTo(512, 175, 904, 160)
    capCtx.stroke()

    const capTex = new T.CanvasTexture(captionCanvas)
    capTex.colorSpace = T.SRGBColorSpace
    addMesh(
      centerTitleGroup,
      new T.PlaneGeometry(6.5, 1.62),
      new T.MeshStandardMaterial({ map: capTex, transparent: true, roughness: 0.95 }),
      0,
      -2.1,
      0.01
    )

    // =========================================================================
    // ASSET 1: 3D WIREFRAME SKETCHBOOK (Bottom-Left)
    // =========================================================================
    const sketchbook = new T.Group()
    scene.add(sketchbook)
    sketchbook.userData = { key: 'projects' }

    box(sketchbook, 3.4, 2.7, 0.14, material('#1b1f1d', 0.1, 0.72), 0, 0, 0.07, 0.1)
    box(sketchbook, 3.28, 2.58, 0.09, warmPaper, 0, 0, 0.12, 0.06)

    const sketchCanvas = document.createElement('canvas')
    sketchCanvas.width = 1024
    sketchCanvas.height = 768
    const sCtx = sketchCanvas.getContext('2d')!
    sCtx.fillStyle = '#f8f5ea'
    sCtx.fillRect(0, 0, 1024, 768)

    sCtx.fillStyle = '#ccd4ce'
    for (let x = 40; x < 984; x += 32) {
      for (let y = 40; y < 728; y += 32) {
        sCtx.beginPath()
        sCtx.arc(x, y, 1.5, 0, Math.PI * 2)
        sCtx.fill()
      }
    }

    sCtx.strokeStyle = '#36403a'
    sCtx.lineWidth = 4
    sCtx.strokeRect(70, 70, 400, 280)
    sCtx.strokeRect(90, 95, 140, 40)
    sCtx.strokeRect(90, 150, 360, 180)
    sCtx.strokeRect(70, 380, 400, 300)
    sCtx.strokeRect(90, 410, 170, 120)
    sCtx.strokeRect(280, 410, 170, 120)

    sCtx.font = 'bold 36px Arial'
    sCtx.fillStyle = '#222b26'
    sCtx.fillText('DASHBOARD ARCHITECTURE', 550, 110)
    sCtx.font = '22px Arial'
    sCtx.fillStyle = '#55625a'
    sCtx.fillText('User Flows, KPI Hierarchy & Design Tokens', 550, 150)

    sCtx.strokeStyle = '#e8592c'
    sCtx.lineWidth = 3
    sCtx.strokeRect(550, 190, 190, 110)
    sCtx.strokeRect(760, 190, 190, 110)
    sCtx.strokeRect(550, 320, 400, 220)

    const sketchTex = new T.CanvasTexture(sketchCanvas)
    sketchTex.colorSpace = T.SRGBColorSpace
    addMesh(sketchbook, new T.PlaneGeometry(3.15, 2.45), new T.MeshStandardMaterial({ map: sketchTex, roughness: 0.92 }), 0, 0, 0.17)

    // Spiral binding rings
    const wireGroup = new T.Group()
    sketchbook.add(wireGroup)
    for (let i = 0; i < 14; i++) {
      const y = -1.15 + i * 0.175
      const wire = new T.Mesh(new T.TorusGeometry(0.07, 0.015, 12, 24), chromeMetal)
      wire.position.set(-1.64, y, 0.09)
      wire.rotation.y = Math.PI / 2
      wire.castShadow = true
      wireGroup.add(wire)
    }

    // Designer gel pen on sketchbook
    const pen = new T.Group()
    sketchbook.add(pen)
    addMesh(pen, new T.CylinderGeometry(0.045, 0.045, 2.4, 24), material('#161817', 0.2, 0.3, 0.6), -0.65, -0.15, 0.24).rotation.z = 0.42
    addMesh(pen, new T.ConeGeometry(0.045, 0.22, 24), chromeMetal, -1.02, -1.2, 0.24).rotation.z = 0.42
    addMesh(pen, new T.CylinderGeometry(0.05, 0.05, 0.6, 24), chromeMetal, -0.32, 0.72, 0.24).rotation.z = 0.42
    addMesh(pen, new T.BoxGeometry(0.02, 0.4, 0.06), chromeMetal, -0.27, 0.65, 0.28).rotation.z = 0.42

    clickableObjects.push({ mesh: sketchbook, key: 'projects', originalScale: 1.0 })

    // =========================================================================
    // ASSET 2: 3D STICKY NOTE PAD (Left-Center)
    // =========================================================================
    const stickyNote = new T.Group()
    scene.add(stickyNote)
    stickyNote.userData = { key: 'about' }

    box(stickyNote, 2.3, 2.3, 0.12, canaryYellow, 0, 0, 0.06, 0.04)

    const stickyCanvas = document.createElement('canvas')
    stickyCanvas.width = 512
    stickyCanvas.height = 512
    const stCtx = stickyCanvas.getContext('2d')!
    stCtx.fillStyle = '#ffea6c'
    stCtx.fillRect(0, 0, 512, 512)

    stCtx.fillStyle = '#1e2420'
    stCtx.font = 'bold 38px "Outfit", sans-serif'
    stCtx.fillText('PROCESS ✦', 45, 75)
    stCtx.font = '600 30px "Outfit", sans-serif'
    stCtx.fillText('✓  Ideas', 45, 140)
    stCtx.fillText('✓  Strategy', 45, 200)
    stCtx.fillText('✓  Design', 45, 260)
    stCtx.fillText('✓  Results', 45, 320)

    stCtx.fillStyle = '#e8592c'
    stCtx.fillRect(330, 270, 28, 60)
    stCtx.fillRect(370, 230, 28, 100)
    stCtx.fillRect(410, 180, 28, 150)
    stCtx.fillRect(450, 130, 28, 200)

    const stickyTex = new T.CanvasTexture(stickyCanvas)
    stickyTex.colorSpace = T.SRGBColorSpace

    const peelGeo = new T.PlaneGeometry(2.26, 2.26, 16, 16)
    const posAttr = peelGeo.attributes.position
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i)
      const factor = Math.max(0, -y / 1.13)
      posAttr.setZ(i, Math.pow(factor, 2.2) * 0.18)
    }
    peelGeo.computeVertexNormals()
    addMesh(stickyNote, peelGeo, new T.MeshStandardMaterial({ map: stickyTex, roughness: 0.85 }), 0, 0, 0.13)
    makeTape(0, 1.05, 0.15, -0.06).parent = stickyNote

    clickableObjects.push({ mesh: stickyNote, key: 'about', originalScale: 1.0 })

    // =========================================================================
    // ASSET 3: 3D POLAROID BOTANICAL PRINT & BINDER CLIP (Right-Center)
    // =========================================================================
    const polaroid = new T.Group()
    scene.add(polaroid)
    polaroid.userData = { key: 'skills' }

    box(polaroid, 2.5, 3.2, 0.05, warmPaper, 0, 0, 0.025, 0.05)

    const polCanvas = document.createElement('canvas')
    polCanvas.width = 512
    polCanvas.height = 650
    const pCtx = polCanvas.getContext('2d')!
    pCtx.fillStyle = '#f8f6ee'
    pCtx.fillRect(0, 0, 512, 650)
    pCtx.fillStyle = '#dde8e0'
    pCtx.fillRect(30, 30, 452, 452)

    pCtx.strokeStyle = '#1a432e'
    pCtx.lineWidth = 7
    pCtx.beginPath()
    pCtx.moveTo(256, 440)
    pCtx.quadraticCurveTo(250, 240, 256, 80)
    pCtx.stroke()

    const leaves = [
      [256, 380, 130, 50, -0.4, '#26593f'],
      [256, 340, 130, 50, 0.45, '#316e4e'],
      [256, 260, 120, 45, -0.5, '#3d865f'],
      [256, 210, 120, 45, 0.55, '#4a9f72'],
      [256, 140, 95, 38, -0.35, '#5bb884'],
      [256, 90, 80, 32, 0.2, '#6cc794']
    ] as const

    for (const [lx, ly, rx, ry, rot, col] of leaves) {
      pCtx.save()
      pCtx.translate(lx, ly)
      pCtx.rotate(rot)
      pCtx.fillStyle = col
      pCtx.beginPath()
      pCtx.ellipse(rx * 0.5, 0, rx * 0.5, ry * 0.5, 0, 0, Math.PI * 2)
      pCtx.fill()
      pCtx.restore()
    }

    const swatches = ['#0e3d2b', '#3b7a54', '#f4f0e6', '#e8592c']
    swatches.forEach((col, idx) => {
      pCtx.fillStyle = col
      pCtx.beginPath()
      pCtx.arc(80 + idx * 60, 535, 18, 0, Math.PI * 2)
      pCtx.fill()
    })

    pCtx.font = 'bold 22px "Outfit", sans-serif'
    pCtx.fillStyle = '#39463e'
    pCtx.fillText('Color System →', 80, 600)

    const polTex = new T.CanvasTexture(polCanvas)
    polTex.colorSpace = T.SRGBColorSpace
    addMesh(polaroid, new T.PlaneGeometry(2.38, 3.08), new T.MeshPhysicalMaterial({ map: polTex, roughness: 0.35, clearcoat: 0.8 }), 0, 0, 0.055)

    // Binder clip
    const clipGroup = new T.Group()
    polaroid.add(clipGroup)
    clipGroup.position.set(0, 1.5, 0.06)
    const clipBody = addMesh(clipGroup, new T.CylinderGeometry(0.12, 0.12, 0.65, 3), plasticDark, 0, 0, 0.05)
    clipBody.rotation.z = Math.PI / 2

    const handleWire = (side: number) => {
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(-0.24, 0, 0.06),
        new T.Vector3(-0.24, 0.35 * side, 0.14),
        new T.Vector3(0, 0.42 * side, 0.16),
        new T.Vector3(0.24, 0.35 * side, 0.14),
        new T.Vector3(0.24, 0, 0.06)
      ])
      return addMesh(clipGroup, new T.TubeGeometry(curve, 32, 0.016, 12, false), chromeMetal)
    }
    handleWire(1)
    handleWire(-1)

    clickableObjects.push({ mesh: polaroid, key: 'skills', originalScale: 1.0 })

    // =========================================================================
    // ASSET 4: 3D STABILO BOSS HIGHLIGHTER (Bottom-Right)
    // =========================================================================
    const highlighter = new T.Group()
    scene.add(highlighter)
    highlighter.userData = { key: 'contact' }

    box(highlighter, 0.95, 2.1, 0.42, neonOrange, 0, 0, 0.21, 0.18)
    box(highlighter, 1.02, 0.85, 0.46, plasticDark, 0, 1.35, 0.23, 0.12)
    box(highlighter, 0.16, 0.72, 0.14, plasticDark, 0, 1.35, 0.50, 0.04)

    const hlCanvas = document.createElement('canvas')
    hlCanvas.width = 256
    hlCanvas.height = 512
    const hCtx = hlCanvas.getContext('2d')!
    hCtx.fillStyle = '#ff5722'
    hCtx.fillRect(0, 0, 256, 512)
    hCtx.save()
    hCtx.translate(128, 256)
    hCtx.rotate(-Math.PI / 2)
    hCtx.font = '900 48px "Outfit", Arial'
    hCtx.fillStyle = '#ffffff'
    hCtx.textAlign = 'center'
    hCtx.fillText('STABILO', 0, -10)
    hCtx.font = '800 36px "Outfit", Arial'
    hCtx.fillText('BOSS', 0, 40)
    hCtx.restore()

    const hlTex = new T.CanvasTexture(hlCanvas)
    hlTex.colorSpace = T.SRGBColorSpace
    addMesh(highlighter, new T.PlaneGeometry(0.88, 1.95), new T.MeshStandardMaterial({ map: hlTex, roughness: 0.42 }), 0, 0, 0.425)

    clickableObjects.push({ mesh: highlighter, key: 'contact', originalScale: 1.0 })

    // =========================================================================
    // ASSET 5: 3D STAINLESS STEEL PRECISION RULER (Bottom-Right)
    // =========================================================================
    const ruler = new T.Group()
    scene.add(ruler)
    box(ruler, 6.2, 0.82, 0.035, aluminumSilver, 0, 0, 0.02, 0.04)

    const rCanvas = document.createElement('canvas')
    rCanvas.width = 1024
    rCanvas.height = 128
    const rCtx = rCanvas.getContext('2d')!
    rCtx.fillStyle = '#cdd4da'
    rCtx.fillRect(0, 0, 1024, 128)
    rCtx.strokeStyle = '#1b221d'
    rCtx.lineWidth = 2.5
    rCtx.beginPath()
    for (let i = 0; i < 60; i++) {
      const x = 30 + i * 16.2
      const isMajor = i % 10 === 0
      const isMid = i % 5 === 0
      const len = isMajor ? 55 : (isMid ? 38 : 22)
      rCtx.moveTo(x, 0)
      rCtx.lineTo(x, len)
      if (isMajor && i > 0) {
        rCtx.font = 'bold 24px Arial'
        rCtx.fillStyle = '#1b221d'
        rCtx.textAlign = 'center'
        rCtx.fillText(String(i / 2), x, 85)
      }
    }
    rCtx.stroke()

    rCtx.font = 'bold 20px Arial'
    rCtx.fillStyle = '#2f3b33'
    rCtx.textAlign = 'right'
    rCtx.fillText('STAINLESS STEEL 30 CM', 980, 85)

    const rulerTex = new T.CanvasTexture(rCanvas)
    rulerTex.colorSpace = T.SRGBColorSpace
    addMesh(ruler, new T.PlaneGeometry(6.1, 0.76), new T.MeshStandardMaterial({ map: rulerTex, metalness: 0.92, roughness: 0.22 }), 0, 0, 0.04)

    // =========================================================================
    // ASSET 6: 3D DISNEY / BLENDER STYLIZED DSLR CAMERA (Top-Right)
    // =========================================================================
    const cameraProp = new T.Group()
    scene.add(cameraProp)
    cameraProp.userData = { key: 'skills' }

    // Photo Prints under Camera
    const print1 = box(cameraProp, 2.4, 3.0, 0.03, warmPaper, 0.2, 0.2, 0.015, 0.04)
    print1.rotation.z = -0.32
    const print2 = box(cameraProp, 2.4, 3.0, 0.03, warmPaper, 0, 0, 0.045, 0.04)
    print2.rotation.z = -0.15

    // Camera Body (Ergonomic rounded chassis with textured grip)
    box(cameraProp, 2.3, 1.6, 1.15, plasticDark, 0, 0, 0.65, 0.18)
    box(cameraProp, 1.0, 0.68, 0.45, plasticDark, -0.15, 0.2, 1.30, 0.08)
    box(cameraProp, 0.42, 0.38, 0.06, chromeMetal, -0.15, 0.2, 1.55, 0.02)

    // Mode Dial & Shutter Button
    const dial = addMesh(cameraProp, new T.CylinderGeometry(0.24, 0.24, 0.22, 32), chromeMetal, 0.68, 0.2, 1.30)
    dial.rotation.x = Math.PI / 2
    addMesh(cameraProp, new T.CylinderGeometry(0.04, 0.04, 0.23, 16), neonOrange, 0.68, 0.32, 1.30).rotation.x = Math.PI / 2

    const shutter = addMesh(cameraProp, new T.CylinderGeometry(0.16, 0.18, 0.16, 24), chromeMetal, 0.74, -0.42, 1.25)
    shutter.rotation.x = Math.PI / 2

    // Telephoto Zoom Lens Assembly
    const lensGroup = new T.Group()
    cameraProp.add(lensGroup)
    lensGroup.position.set(-0.25, -0.15, 1.25)

    addMesh(lensGroup, new T.CylinderGeometry(0.72, 0.76, 0.5, 36), plasticDark, 0, 0, 0.25).rotation.x = Math.PI / 2
    addMesh(lensGroup, new T.CylinderGeometry(0.725, 0.725, 0.05, 36), neonOrange, 0, 0, 0.52).rotation.x = Math.PI / 2
    addMesh(lensGroup, new T.CylinderGeometry(0.68, 0.72, 0.65, 36), plasticDark, 0, 0, 0.85).rotation.x = Math.PI / 2
    addMesh(lensGroup, new T.CylinderGeometry(0.70, 0.70, 0.42, 36), material('#0f1210', 0.02, 0.85), 0, 0, 0.85).rotation.x = Math.PI / 2
    addMesh(lensGroup, new T.CylinderGeometry(0.64, 0.68, 0.22, 36), plasticDark, 0, 0, 1.25).rotation.x = Math.PI / 2

    const glassMat = new T.MeshPhysicalMaterial({
      color: '#e2f0fd',
      transmission: 0.92,
      opacity: 0.85,
      transparent: true,
      roughness: 0.05,
      ior: 1.55,
      reflectivity: 0.95,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    })
    const frontLens = addMesh(lensGroup, new T.SphereGeometry(0.55, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), glassMat, 0, 0, 1.15)
    frontLens.rotation.x = -Math.PI / 2

    clickableObjects.push({ mesh: cameraProp, key: 'skills', originalScale: 1.0 })

    // =========================================================================
    // ASSET 7: 3D APPLE WIRED EARPODS
    // =========================================================================
    const earpods = new T.Group()
    scene.add(earpods)

    const cableCurve = new T.CatmullRomCurve3([
      new T.Vector3(0.5, 1.8, 0.04),
      new T.Vector3(0.2, 1.1, 0.03),
      new T.Vector3(0.8, 0.3, 0.025),
      new T.Vector3(1.2, -0.6, 0.03),
      new T.Vector3(0.4, -1.2, 0.03),
      new T.Vector3(-0.3, -1.8, 0.04)
    ])
    addMesh(earpods, new T.TubeGeometry(cableCurve, 64, 0.022, 12, false), plasticWhite)

    const leftBranch = new T.CatmullRomCurve3([
      new T.Vector3(0.8, 0.3, 0.025),
      new T.Vector3(0.4, 0.6, 0.035),
      new T.Vector3(-0.2, 0.9, 0.06)
    ])
    addMesh(earpods, new T.TubeGeometry(leftBranch, 32, 0.018, 12, false), plasticWhite)

    const buildEarPod = (x: number, y: number, z: number, rotZ: number) => {
      const pod = new T.Group()
      earpods.add(pod)
      pod.position.set(x, y, z)
      pod.rotation.z = rotZ
      addMesh(pod, new T.SphereGeometry(0.12, 24, 18), plasticWhite, 0, 0, 0.08).scale.set(1.1, 1.4, 0.9)
      addMesh(pod, new T.CylinderGeometry(0.035, 0.035, 0.35, 16), plasticWhite, 0.05, -0.22, 0.06).rotation.z = 0.15
      addMesh(pod, new T.CircleGeometry(0.045, 16), material('#353d38', 0.2, 0.8), -0.04, 0.04, 0.16)
    }
    buildEarPod(-0.25, 0.95, 0.06, 0.45)
    buildEarPod(0.55, 1.9, 0.05, -0.65)

    // =========================================================================
    // ASSET 8: 3D WOODEN PENCILS & ARTIST ERASER
    // =========================================================================
    const stationeryGroup = new T.Group()
    scene.add(stationeryGroup)

    const createPencil = (bodyColor: string) => {
      const p = new T.Group()
      addMesh(p, new T.CylinderGeometry(0.055, 0.055, 2.5, 6), material(bodyColor, 0, 0.4, 0.4), 0, 0, 0.06).rotation.z = Math.PI / 2
      addMesh(p, new T.ConeGeometry(0.055, 0.30, 16), material('#e8cfab', 0, 0.85), -1.40, 0, 0.06).rotation.z = Math.PI / 2
      addMesh(p, new T.ConeGeometry(0.022, 0.12, 16), material('#181b19', 0.85, 0.25), -1.50, 0, 0.06).rotation.z = Math.PI / 2
      addMesh(p, new T.CylinderGeometry(0.056, 0.056, 0.20, 16), brassGold, 1.35, 0, 0.06).rotation.z = Math.PI / 2
      addMesh(p, new T.CylinderGeometry(0.052, 0.052, 0.18, 16), material('#f28d9c', 0, 0.75), 1.50, 0, 0.06).rotation.z = Math.PI / 2
      return p
    }

    const pencilYellow = createPencil('#f5b041')
    stationeryGroup.add(pencilYellow)

    const pencilNavy = createPencil('#2e4053')
    stationeryGroup.add(pencilNavy)

    const eraserGroup = new T.Group()
    stationeryGroup.add(eraserGroup)
    box(eraserGroup, 0.85, 0.48, 0.24, material('#fcfcfc', 0, 0.65), 0, 0, 0.12, 0.05)
    box(eraserGroup, 0.52, 0.50, 0.25, material('#1f618d', 0, 0.7), 0.15, 0, 0.125, 0.03)

    // =========================================================================
    // ASSET 9: 3D METALLIC WIRE PAPERCLIPS
    // =========================================================================
    const clips = [new T.Group(), new T.Group(), new T.Group()]
    for (const clip of clips) {
      scene.add(clip)
      const pts = [
        [-0.09, -0.22], [-0.09, 0.22], [-0.04, 0.32], [0.08, 0.32],
        [0.14, 0.22], [0.14, -0.32], [0.05, -0.40], [-0.09, -0.39],
        [-0.18, -0.28], [-0.18, 0.20], [-0.11, 0.42], [0.07, 0.45],
        [0.23, 0.32], [0.23, -0.20]
      ]
      const curve = new T.CatmullRomCurve3(pts.map(([x, y]) => new T.Vector3(x, y, 0.045)))
      addMesh(clip, new T.TubeGeometry(curve, 96, 0.016, 12, false), chromeMetal)
    }

    // =========================================================================
    // ASSET 10 & 11: 3D LAPTOP & RETRO GAMEBOY (GLTF + Enhanced 3D Geometry)
    // =========================================================================
    const laptop = new T.Group()
    scene.add(laptop)
    laptop.userData = { key: 'projects' }
    clickableObjects.push({ mesh: laptop, key: 'projects', originalScale: 1.0 })

    const gameboy = new T.Group()
    scene.add(gameboy)
    gameboy.userData = { key: 'contact' }
    clickableObjects.push({ mesh: gameboy, key: 'contact', originalScale: 1.0 })

    // Detailed 3D Retro GameBoy Assembly (Immediately visible with PBR materials)
    const gbBodyMat = material('#d6d8d5', 0.05, 0.65, 0.25)
    box(gameboy, 2.05, 3.2, 0.48, gbBodyMat, 0, 0, 0.24, 0.18)

    // Curved battery grip contour & bevels on sides
    box(gameboy, 1.75, 1.45, 0.05, material('#373c40', 0.1, 0.5, 0.6), 0, 0.65, 0.49, 0.08)

    // Retro LCD screen
    const gbCanvas = document.createElement('canvas')
    gbCanvas.width = 256; gbCanvas.height = 256
    const gbCtx = gbCanvas.getContext('2d')!
    gbCtx.fillStyle = '#8f9c18'; gbCtx.fillRect(0, 0, 256, 256)
    gbCtx.fillStyle = '#1b341b'
    gbCtx.font = 'bold 24px monospace'; gbCtx.textAlign = 'center'
    gbCtx.fillText('HELLENS ✳', 128, 70)
    gbCtx.font = '16px monospace'
    gbCtx.fillText('PRESS START', 128, 115)
    for (let bx = 0; bx < 5; bx++) {
      for (let by = 0; by < 2; by++) {
        gbCtx.fillRect(40 + bx * 36, 150 + by * 36, 30, 30)
      }
    }
    const gbTex = new T.CanvasTexture(gbCanvas)
    gbTex.colorSpace = T.SRGBColorSpace
    addMesh(gameboy, new T.PlaneGeometry(1.35, 1.08), new T.MeshStandardMaterial({ map: gbTex, roughness: 0.35 }), 0, 0.65, 0.52)
    addMesh(gameboy, new T.CircleGeometry(0.04, 16), material('#ff2200', 0, 0.1, 1.0), -0.72, 0.65, 0.525)

    // D-Pad Cross
    const dpadMat = material('#1b1e22', 0.05, 0.7, 0.1)
    box(gameboy, 0.24, 0.72, 0.14, dpadMat, -0.48, -0.46, 0.54, 0.04)
    box(gameboy, 0.72, 0.24, 0.14, dpadMat, -0.48, -0.46, 0.54, 0.04)
    addMesh(gameboy, new T.SphereGeometry(0.06, 16, 16), dpadMat, -0.48, -0.46, 0.56)

    // Magenta A & B buttons
    const btnMat = material('#9c1b52', 0.05, 0.45, 0.5)
    addMesh(gameboy, new T.CylinderGeometry(0.13, 0.13, 0.16, 24), btnMat, 0.58, -0.34, 0.54).rotation.x = Math.PI / 2
    addMesh(gameboy, new T.CylinderGeometry(0.13, 0.13, 0.16, 24), btnMat, 0.34, -0.52, 0.54).rotation.x = Math.PI / 2

    // Select & Start rubber pills
    const pillMat = material('#52585c', 0, 0.8, 0)
    const p1 = box(gameboy, 0.32, 0.09, 0.07, pillMat, -0.16, -1.02, 0.51, 0.03)
    p1.rotation.z = -0.45
    const p2 = box(gameboy, 0.32, 0.09, 0.07, pillMat, 0.16, -1.02, 0.51, 0.03)
    p2.rotation.z = -0.45

    // Acoustic speaker slits
    for (let i = 0; i < 6; i++) {
      const slit = box(gameboy, 0.04, 0.36, 0.02, plasticDark, 0.45 + i * 0.08, -1.05 + i * 0.03, 0.50, 0.01)
      slit.rotation.z = -0.5
    }

    // High-Detail 3D MacBook Assembly
    box(laptop, 4.4, 3.1, 0.14, aluminumSilver, 0, 0, 0.07, 0.14)
    box(laptop, 4.15, 1.85, 0.04, plasticDark, 0, 0.45, 0.15, 0.06)
    box(laptop, 1.5, 0.95, 0.02, aluminumSilver, 0, -0.9, 0.15, 0.04)

    // Keyboard keys rows
    const keysRow = (y: number, count: number, w: number) => {
      const totalW = count * (w + 0.04)
      for (let i = 0; i < count; i++) {
        const x = -totalW / 2 + i * (w + 0.04) + w / 2
        box(laptop, w, 0.22, 0.035, plasticDark, x, y, 0.165, 0.02)
      }
    }
    keysRow(1.15, 14, 0.24)
    keysRow(0.88, 14, 0.24)
    keysRow(0.61, 13, 0.26)
    keysRow(0.34, 12, 0.29)
    keysRow(0.07, 8, 0.38)

    // Glowing Open Laptop Screen
    const screenLid = new T.Group()
    laptop.add(screenLid)
    screenLid.position.set(0, 1.55, 0.07)
    screenLid.rotation.x = -Math.PI * 0.42 // Open lid angle

    box(screenLid, 4.4, 2.9, 0.08, aluminumSilver, 0, 1.45, 0.04, 0.14)
    box(screenLid, 4.15, 2.65, 0.02, plasticDark, 0, 1.45, 0.085, 0.04)

    // Dashboard UI Canvas Texture on screen
    const dashCanvas = document.createElement('canvas')
    dashCanvas.width = 1024; dashCanvas.height = 640
    const dCtx = dashCanvas.getContext('2d')!
    dCtx.fillStyle = '#0a100d'; dCtx.fillRect(0, 0, 1024, 640)
    dCtx.fillStyle = '#14221b'; dCtx.fillRect(30, 30, 964, 80)
    dCtx.fillStyle = '#ffffff'; dCtx.font = 'bold 28px Arial'; dCtx.fillText('HELLENS ANALYTICS PLATFORM', 60, 80)
    // KPI Cards
    const kpiColors = ['#e8592c', '#218358', '#3b82f6']
    for (let k = 0; k < 3; k++) {
      dCtx.fillStyle = '#111d16'; dCtx.fillRect(30 + k * 330, 140, 300, 150)
      dCtx.fillStyle = kpiColors[k]; dCtx.fillRect(30 + k * 330, 140, 300, 6)
      dCtx.fillStyle = '#ffffff'; dCtx.font = 'bold 36px Arial'; dCtx.fillText(['98.4%', '$1.4M', '45.2k'][k], 60 + k * 330, 230)
    }
    // Main Chart
    dCtx.fillStyle = '#111d16'; dCtx.fillRect(30, 320, 964, 280)
    dCtx.strokeStyle = '#e8592c'; dCtx.lineWidth = 4; dCtx.beginPath()
    for (let pt = 0; pt < 10; pt++) {
      const cx = 60 + pt * 100
      const cy = 540 - Math.sin(pt * 0.8) * 120 - pt * 10
      pt === 0 ? dCtx.moveTo(cx, cy) : dCtx.lineTo(cx, cy)
    }
    dCtx.stroke()

    const dashTex = new T.CanvasTexture(dashCanvas)
    dashTex.colorSpace = T.SRGBColorSpace
    const screenMesh = new T.Mesh(
      new T.PlaneGeometry(3.95, 2.45),
      new T.MeshBasicMaterial({ map: dashTex })
    )
    screenMesh.position.set(0, 1.45, 0.10)
    screenLid.add(screenMesh)

    // Raycasting for 3D Object Interactivity
    const raycaster = new T.Raycaster()
    const pointer = new T.Vector2(-999, -999)
    let hoveredObject: T.Object3D | null = null

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(pointer, camera)
      const targets = clickableObjects.map(c => c.mesh)
      const intersects = raycaster.intersectObjects(targets, true)

      if (intersects.length > 0) {
        let topGroup: T.Object3D | null = intersects[0].object
        while (topGroup && !topGroup.userData?.key && topGroup.parent && topGroup.parent !== scene) {
          topGroup = topGroup.parent
        }
        if (topGroup?.userData?.key) {
          container.style.cursor = 'pointer'
          hoveredObject = topGroup
        } else {
          container.style.cursor = 'default'
          hoveredObject = null
        }
      } else {
        container.style.cursor = 'default'
        hoveredObject = null
      }
    }

    const onPointerDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const rect = container.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(pointer, camera)
      const targets = clickableObjects.map(c => c.mesh)
      const intersects = raycaster.intersectObjects(targets, true)

      if (intersects.length > 0) {
        let topGroup: T.Object3D | null = intersects[0].object
        while (topGroup && !topGroup.userData?.key && topGroup.parent && topGroup.parent !== scene) {
          topGroup = topGroup.parent
        }
        if (topGroup?.userData?.key) {
          onSelectRef.current?.(topGroup.userData.key)
        }
      }
    }

    window.addEventListener('mousemove', onPointerMove, { passive: true })
    window.addEventListener('click', onPointerDown)

    // Animation Loop with Smooth Mouse Parallax
    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)

      // Cinematic camera tilt parallax
      const targetCamX = mousePosRef.current.x * 0.6
      const targetCamY = -2.6 + mousePosRef.current.y * 0.4
      camera.position.x += (targetCamX - camera.position.x) * 0.08
      camera.position.y += (targetCamY - camera.position.y) * 0.08
      camera.lookAt(0, 0.3, 0)

      // Hover micro-animations on 3D clickable assets
      clickableObjects.forEach(item => {
        const isHovered = hoveredObject === item.mesh
        const targetScale = isHovered ? item.originalScale * 1.035 : item.originalScale
        item.mesh.scale.lerp(new T.Vector3(targetScale, targetScale, targetScale), 0.12)
      })

      renderer.render(scene, camera)
    }
    animId = requestAnimationFrame(animate)

    function resize() {
      const w = container.clientWidth
      const h = container.clientHeight
      const aspect = w / h
      if (!w || !h) return

      renderer.setSize(w, h, false)
      camera.aspect = aspect
      camera.updateProjectionMatrix()

      const halfY = Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * camera.position.z
      const halfX = halfY * aspect

      if (surfaceMaterial.map?.userData.width !== w || surfaceMaterial.map?.userData.height !== h) {
        surfaceMaterial.map?.dispose()
        const surface = createMatSurface(w, h)
        surface.colorSpace = T.SRGBColorSpace
        surface.userData = { width: w, height: h }
        surfaceMaterial.map = surface
        surfaceMaterial.needsUpdate = true
      }

      floor.scale.set(halfX * 3.2, halfY * 3.2, 1)
      sceneExtent.value.set(halfX * 3.2, halfY * 3.2)

      const mobile = aspect < 0.85
      const scaleMultiplier = mobile ? 0.72 : 1.0

      // Center 3D Title Paper Group
      centerTitleGroup.position.set(0, mobile ? 0.35 : 0.28, 0)
      centerTitleGroup.scale.setScalar(mobile ? 0.65 : 0.88)

      // Laptop (Top Left)
      laptop.position.set(-halfX * 0.88, halfY * 0.72, 0.02)
      laptop.scale.setScalar((mobile ? 0.72 : 1.05) * scaleMultiplier)
      laptop.rotation.set(0.12, 0.14, 0.36)

      // DSLR Camera (Top Right Corner resting on photo prints)
      cameraProp.position.set(halfX * 0.86, halfY * 0.72, 0.02)
      cameraProp.scale.setScalar((mobile ? 0.75 : 0.95) * scaleMultiplier)
      cameraProp.rotation.set(0.18, -0.15, -0.42)

      // Retro Gameboy (Upper-Mid Right Desk, between camera and polaroid)
      gameboy.position.set(halfX * 0.76, 0.95, 0.02)
      gameboy.scale.setScalar((mobile ? 0.72 : 0.92) * scaleMultiplier)
      gameboy.rotation.set(0.12, -0.06, -0.22)

      // Sketchbook (Bottom Left)
      sketchbook.position.set(-halfX * 0.75, -halfY * 0.65, 0.02)
      sketchbook.scale.setScalar((mobile ? 0.75 : 1.0) * scaleMultiplier)
      sketchbook.rotation.set(0.08, 0.04, 0.10)

      // Yellow Drafting Pencil (Beside sketchbook at bottom-left)
      pencilYellow.position.set(-halfX * 0.45, -halfY * 0.75, 0.02)
      pencilYellow.rotation.z = 0.22
      pencilYellow.scale.setScalar(scaleMultiplier)

      // Artist Eraser (Bottom Left near pencil)
      eraserGroup.position.set(-halfX * 0.55, -halfY * 0.88, 0.02)
      eraserGroup.rotation.z = 0.25
      eraserGroup.scale.setScalar(scaleMultiplier)

      // Sticky Note Pad (Left Center under laptop)
      stickyNote.position.set(-halfX * 0.72, 0.75, 0.02)
      stickyNote.scale.setScalar((mobile ? 0.78 : 0.95) * scaleMultiplier)
      stickyNote.rotation.z = -0.08

      // Polaroid Photo Print (Right Center below Gameboy)
      polaroid.position.set(halfX * 0.78, -0.95, 0.02)
      polaroid.scale.setScalar((mobile ? 0.75 : 0.98) * scaleMultiplier)
      polaroid.rotation.z = 0.12

      // Navy Design Pencil (Near Ruler at Bottom Right)
      pencilNavy.position.set(halfX * 0.38, -halfY * 0.82, 0.02)
      pencilNavy.rotation.z = -0.42
      pencilNavy.scale.setScalar(scaleMultiplier)

      // STABILO Boss Highlighter (Bottom Right)
      highlighter.position.set(halfX * 0.65, -halfY * 0.62, 0.02)
      highlighter.scale.setScalar((mobile ? 0.75 : 0.92) * scaleMultiplier)
      highlighter.rotation.z = 0.45

      // Stainless Steel Ruler (Bottom Right border)
      ruler.position.set(halfX * 0.72, -halfY * 0.85, 0.02)
      ruler.scale.setScalar((mobile ? 0.75 : 0.98) * scaleMultiplier)
      ruler.rotation.z = -0.58

      // EarPods (Right Center draping towards bottom)
      earpods.position.set(halfX * 0.52, -0.85, 0.02)
      earpods.scale.setScalar((mobile ? 0.75 : 0.92) * scaleMultiplier)
      earpods.rotation.z = -0.15

      // Paperclips scattered naturally
      clips.forEach((c, i) => {
        c.position.set(halfX * 0.58 - i * 0.45, -halfY * 0.82 - i * 0.35, 0.01)
        c.rotation.z = 0.35 + i * 0.6
        c.scale.setScalar((mobile ? 0.68 : 0.85) * scaleMultiplier)
      })

      clickableObjects.forEach(c => {
        c.originalScale = c.mesh.scale.x
      })

      unifyLight(scene)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('click', onPointerDown)
      observer.disconnect()

      const geometries = new Set<T.BufferGeometry>()
      const materials = new Set<T.Material>()
      const textures = new Set<T.Texture>()

      scene.traverse(o => {
        if (o instanceof T.Mesh) {
          geometries.add(o.geometry)
          for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
            materials.add(m)
            for (const value of Object.values(m)) {
              if (value instanceof T.Texture) textures.add(value)
            }
          }
        }
      })

      geometries.forEach(g => g.dispose())
      textures.forEach(t => t.dispose())
      materials.forEach(m => m.dispose())

      canopyTexture.dispose()
      environment.dispose()
      grainMap.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div className="desk-three" ref={host} aria-label="3D Creative Desk Canvas" />
}
