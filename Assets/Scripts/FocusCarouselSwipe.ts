import {HandInputData} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

const SWIPE_THRESHOLD_3D = 5
const SWIPE_THRESHOLD_2D = 0.05
const INDEX_TOUCH_DEPTH_CM = 7
const INDEX_RELEASE_DEPTH_CM = 10
// Arrastre continuo: cuántos cm de dedo equivalen a "una card entera"
const DRAG_RANGE_CM = 26
const DRAG_RANGE_2D = 0.3
// Al soltar, con cuánto avance se pasa a la card vecina
const SNAP_THRESHOLD = 0.3

@component
export class FocusCarouselSwipe extends BaseScriptComponent {
  private readonly swipeEvent = new Event<number>()
  private readonly scrollEvent = new Event<number>()
  private readonly dragEvent = new Event<number>()
  private handProvider = HandInputData.getInstance()
  private cameraProvider = WorldCameraFinderProvider.getInstance()
  private states = {
    left: {pinching: false, start: vec3.zero(), maxDelta: vec3.zero(), time: 0},
    right: {pinching: false, start: vec3.zero(), maxDelta: vec3.zero(), time: 0},
  }
  private touchStart = vec2.zero()
  private touchDragging = false
  private indexDragTarget: SceneObject | null = null
  private indexStates = {
    left: {touching: false, start: vec3.zero(), progress: 0},
    right: {touching: false, start: vec3.zero(), progress: 0},
  }

  get onSwipe(): PublicApi<number> { return this.swipeEvent.publicApi() }
  get onScroll(): PublicApi<number> { return this.scrollEvent.publicApi() }
  /** Avance continuo del arrastre en cards (-1..1) mientras el dedo se mueve; 0 al soltar. */
  get onDragProgress(): PublicApi<number> { return this.dragEvent.publicApi() }

  setIndexDragTarget(target: SceneObject): void { this.indexDragTarget = target }

  onAwake(): void {
    const right = this.handProvider.getHand("right")
    const left = this.handProvider.getHand("left")
    const down = (type: "left" | "right", hand: any) => {
      const state = this.states[type]
      if (!hand || !hand.isTracked() || state.pinching) return
      const inv = this.cameraProvider.getComponent().getTransform().getInvertedWorldTransform()
      state.pinching = true
      state.start = inv.multiplyPoint(hand.wrist.position)
      state.maxDelta = vec3.zero()
      state.time = getTime()
    }
    const up = (type: "left" | "right") => {
      const state = this.states[type]
      if (!state.pinching) return
      state.pinching = false
      this.detect3D(state.maxDelta, getTime() - state.time)
    }
    this.createEvent("OnStartEvent").bind(() => {
      right.onPinchDown.add(() => down("right", right)); right.onPinchUp.add(() => up("right")); right.onPinchCancel.add(() => up("right"))
      left.onPinchDown.add(() => down("left", left)); left.onPinchUp.add(() => up("left")); left.onPinchCancel.add(() => up("left"))
    })
    this.createEvent("UpdateEvent").bind(() => {
      const inv = this.cameraProvider.getComponent().getTransform().getInvertedWorldTransform()
      const update = (type: "left" | "right", hand: any) => {
        const state = this.states[type]
        if (!state.pinching || !hand?.isTracked()) return
        const delta = inv.multiplyPoint(hand.wrist.position).sub(state.start)
        if (delta.lengthSquared > state.maxDelta.lengthSquared) state.maxDelta = delta
      }
      update("right", right); update("left", left)
      this.updateIndexDrag("right", right)
      this.updateIndexDrag("left", left)
    })
    this.createEvent("TouchStartEvent").bind((event: TouchStartEvent) => { this.touchStart = event.getTouchPosition(); this.touchDragging = false })
    this.createEvent("TouchMoveEvent").bind((event: TouchMoveEvent) => {
      const delta = event.getTouchPosition().sub(this.touchStart)
      if (!this.touchDragging && Math.abs(delta.x) < SWIPE_THRESHOLD_2D) return
      if (!this.touchDragging && Math.abs(delta.x) < Math.abs(delta.y) * 1.2) return
      this.touchDragging = true
      this.dragEvent.invoke(Math.max(-1.2, Math.min(1.2, delta.x / DRAG_RANGE_2D)))
    })
    this.createEvent("TouchEndEvent").bind((event: TouchEndEvent) => {
      const delta = event.getTouchPosition().sub(this.touchStart)
      if (this.touchDragging) {
        this.touchDragging = false
        this.dragEvent.invoke(0)
        if (Math.abs(delta.x / DRAG_RANGE_2D) >= SNAP_THRESHOLD) this.emit(delta.x)
        return
      }
      if (delta.length < SWIPE_THRESHOLD_2D) return
      if (Math.abs(delta.x) > Math.abs(delta.y) * 1.2) this.emit(delta.x)
      else if (Math.abs(delta.y) > Math.abs(delta.x) * 1.2) this.emitScroll(delta.y > 0 ? -1 : 1)
    })
  }

  private updateIndexDrag(type: "left" | "right", hand: any): void {
    const state = this.indexStates[type]
    if (!this.indexDragTarget || !hand?.isTracked() || this.states[type].pinching) {
      this.releaseIndexDrag(state)
      return
    }
    const local = this.indexDragTarget.getTransform().getInvertedWorldTransform().multiplyPoint(hand.indexTip.position)
    const insideXY = Math.abs(local.x) <= 22 && Math.abs(local.y) <= 23
    const touchingPlane = insideXY && Math.abs(local.z) <= INDEX_TOUCH_DEPTH_CM
    if (!state.touching) {
      if (!touchingPlane) return
      state.touching = true
      state.start = local
      state.progress = 0
      return
    }
    if (!insideXY || Math.abs(local.z) > INDEX_RELEASE_DEPTH_CM) {
      this.releaseIndexDrag(state)
      return
    }
    const delta = local.sub(state.start)
    // Las cards siguen al dedo: avance proporcional, no un salto por umbral.
    state.progress = Math.max(-1.2, Math.min(1.2, delta.x / DRAG_RANGE_CM))
    this.dragEvent.invoke(state.progress)
  }

  private releaseIndexDrag(state: {touching: boolean; start: vec3; progress: number}): void {
    if (!state.touching) return
    state.touching = false
    this.dragEvent.invoke(0)
    if (Math.abs(state.progress) >= SNAP_THRESHOLD) {
      this.emit(state.progress)
      print("[Carousel] snap por arrastre continuo")
    }
    state.progress = 0
  }

  private detect3D(delta: vec3, duration: number): void {
    if (duration > 0.75 || delta.length < SWIPE_THRESHOLD_3D) return
    const x = Math.abs(delta.x), y = Math.abs(delta.y), z = Math.abs(delta.z)
    if (x > y * 1.3 && x > z * 1.3) this.emit(delta.x)
    else if (y > x * 1.3 && y > z * 1.3) this.emitScroll(delta.y > 0 ? -1 : 1)
  }

  private emit(x: number): void {
    const direction = x < 0 ? 1 : -1
    this.swipeEvent.invoke(direction)
    print(direction > 0 ? "[Carousel] siguiente card" : "[Carousel] card anterior")
  }

  private emitScroll(direction: number): void {
    this.scrollEvent.invoke(direction)
    print(direction > 0 ? "[Carousel] tareas siguientes" : "[Carousel] tareas anteriores")
  }
}
