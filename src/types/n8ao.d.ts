declare module 'n8ao' {
  import * as THREE from 'three'
  import { Pass } from 'postprocessing'

  export class N8AOPostPass extends Pass {
    constructor(scene: THREE.Scene, camera: THREE.Camera, width?: number, height?: number)
    configuration: {
      aoRadius: number
      distanceFalloff: number
      intensity: number
      color: THREE.Color
      screenSpaceRadius: boolean
      [key: string]: any
    }
    setQualityMode(mode: 'Low' | 'Medium' | 'High' | 'Ultra'): void
    setSize(width: number, height: number): void
  }

  export class N8AOPass {
    constructor(scene: THREE.Scene, camera: THREE.Camera, width?: number, height?: number)
    configuration: any
    setQualityMode(mode: string): void
    setSize(width: number, height: number): void
  }
}
