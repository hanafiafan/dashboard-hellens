import { CanvasTexture } from 'three'

// Composition traced in normalized portrait coordinates from the supplied reference.
// White blocks sunlight; dark windows transmit it. No detached leaf animation.
export function createFoliageTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024; canvas.height = 1820
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#dedede'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(canvas.width, canvas.height)
  const windows = [
    [.18,.17,.15,.055,-.55],[.34,.105,.10,.052,-.9],
    [.54,.09,.072,.083,.3],[.72,.055,.095,.067,.45],[.91,.17,.085,.06,-.5],
    [.30,.28,.055,.072,.6],[.09,.29,.07,.06,-.4],
    [.51,.245,.065,.055,.6],[.79,.265,.12,.045,-.45],
    [.91,.30,.15,.055,-.5],[.72,.365,.10,.075,-.6],
    [.94,.40,.10,.085,.4],[.47,.41,.13,.07,.1],
    [.36,.49,.085,.075,.3],[.62,.525,.08,.09,.6],
    [.15,.555,.12,.055,-.6],[.31,.62,.095,.065,-.3],
    [.78,.625,.18,.065,-.65],[.61,.69,.075,.072,.5],
    [.24,.735,.10,.063,-.5],[.12,.79,.10,.06,-.6],
    [.49,.80,.08,.05,-.5],[.74,.805,.11,.05,-.5],
    [.90,.84,.13,.056,-.6],[.22,.895,.11,.07,-.6],
    [.40,.953,.09,.05,.4],[.73,.975,.085,.066,.4],
  ]
  for (const [x,y,rx,ry,angle] of windows) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.scale(rx,ry)
    const gradient = ctx.createRadialGradient(0,0,.05,0,0,1)
    gradient.addColorStop(0,'rgba(0,0,0,.98)')
    gradient.addColorStop(.38,'rgba(0,0,0,.87)')
    gradient.addColorStop(.72,'rgba(0,0,0,.38)')
    gradient.addColorStop(1,'rgba(0,0,0,0)')
    ctx.fillStyle = gradient; ctx.fillRect(-1,-1,2,2); ctx.restore()
  }
  const limbs = [
    [[-.05,.90],[.26,.70],[.48,.53],[.66,.28],[.70,-.05]],
    [[.27,.70],[.24,.48],[.29,.30],[.48,.04]],
    [[.48,.53],[.76,.48],[1.1,.29]],
    [[.66,.28],[.90,.12],[1.1,.08]],
    [[.20,1.1],[.49,.89],[.65,.73],[1.1,.55]],
  ]
  ctx.strokeStyle = '#e6e6e6'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const points of limbs) {
    for (let i=1;i<points.length;i++) {
      ctx.lineWidth = .027 * (1 - i * .12)
      ctx.beginPath(); ctx.moveTo(...points[i-1] as [number,number])
      ctx.lineTo(...points[i] as [number,number]); ctx.stroke()
    }
  }
  const soft = document.createElement('canvas')
  soft.width = canvas.width; soft.height = canvas.height
  const out = soft.getContext('2d')!
  out.fillStyle = '#dedede'; out.fillRect(0,0,soft.width,soft.height)
  out.filter = 'blur(9px)'; out.drawImage(canvas,0,0)
  return new CanvasTexture(soft)
}
