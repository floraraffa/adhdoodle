import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

// Heurística de deriva: señal SOSTENIDA, nunca un vistazo.
const AWAY_DISTANCE_CM = 200
const AWAY_ANGLE_DEG = 75
const TRIGGER_SECONDS = 45
const COOLDOWN_SECONDS = 180
const STARTUP_GRACE_SECONDS = 60

/**
 * Centinela de foco: mientras una tarea corre en Focus Mode, ancla la "zona de
 * trabajo" (posición + dirección de mirada al dar Play) y acumula cuánto tiempo
 * sostenido el usuario está lejos o mirando a otra parte. Cuando la evidencia
 * es suficiente dispara UN candidato (que Main puede verificar con visión IA)
 * y entra en cooldown: interviene poco, nunca constantemente.
 */
export class FocusSentinel {
  private camera = WorldCameraFinderProvider.getInstance()
  private active = false
  private anchorPosition = vec3.zero()
  private anchorView = vec3.zero()
  private awaySeconds = 0
  private cooldown = 0

  constructor(private onCandidate: () => void) {}

  start(): void {
    const transform = this.camera.getTransform()
    this.anchorPosition = transform.getWorldPosition()
    this.anchorView = transform.forward.uniformScale(-1)
    this.awaySeconds = 0
    this.cooldown = STARTUP_GRACE_SECONDS
    this.active = true
  }

  stop(): void {
    this.active = false
    this.awaySeconds = 0
  }

  /** Tras verificar que el usuario SÍ sigue en tarea, se le vuelve a dar crédito. */
  markStillFocused(): void {
    this.awaySeconds = 0
  }

  update(deltaSeconds: number): void {
    if (!this.active) return
    if (this.cooldown > 0) this.cooldown -= deltaSeconds

    const transform = this.camera.getTransform()
    const distance = transform.getWorldPosition().distance(this.anchorPosition)
    const view = transform.forward.uniformScale(-1)
    const dot = Math.max(-1, Math.min(1, view.dot(this.anchorView)))
    const angleDeg = (Math.acos(dot) * 180) / Math.PI

    const away = distance > AWAY_DISTANCE_CM || angleDeg > AWAY_ANGLE_DEG
    // Acumula al alejarse; al volver, el crédito se recupera al doble de velocidad.
    this.awaySeconds = away ? this.awaySeconds + deltaSeconds : Math.max(0, this.awaySeconds - deltaSeconds * 2)

    if (this.awaySeconds >= TRIGGER_SECONDS && this.cooldown <= 0) {
      this.cooldown = COOLDOWN_SECONDS
      this.awaySeconds = 0
      print(`[FocusSentinel] candidato a distracción (lejos ${Math.round(distance)}cm, ángulo ${Math.round(angleDeg)}°)`)
      this.onCandidate()
    }
  }
}
