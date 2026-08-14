import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FocusCardState, FocusTaskState} from "./FocusOrganizerState"
import {STR} from "./Strings"

// ——— Assets del diseño "cuaderno kawaii" (Flor) ———
const TEX_PAGES = [
  requireAsset("../DesignAssets/paper-page-home.png") as Texture,
  requireAsset("../DesignAssets/paper-page-work.png") as Texture,
  requireAsset("../DesignAssets/paper-page-me.png") as Texture,
]
const TEX_WASHI = [
  requireAsset("../DesignAssets/washi-yellow.png") as Texture,
  requireAsset("../DesignAssets/washi-pink.png") as Texture,
  requireAsset("../DesignAssets/washi-blue.png") as Texture,
  requireAsset("../DesignAssets/washi-green.png") as Texture,
]
const TEX_BADGES = [
  requireAsset("../DesignAssets/badge-first.png") as Texture,
  requireAsset("../DesignAssets/badge-next.png") as Texture,
  requireAsset("../DesignAssets/badge-later.png") as Texture,
]
const TEX_PLAY = [
  requireAsset("../DesignAssets/play-red.png") as Texture,
  requireAsset("../DesignAssets/play-lilac.png") as Texture,
  requireAsset("../DesignAssets/play-green.png") as Texture,
  requireAsset("../DesignAssets/play-green2.png") as Texture,
]
const TEX_ADD_TASK = requireAsset("../DesignAssets/add-a-task.png") as Texture
const TEX_ICONS = {
  add: requireAsset("../DesignAssets/icon-add.png") as Texture,
  priorityUp: requireAsset("../DesignAssets/icon-priority-up.png") as Texture,
  priorityDown: requireAsset("../DesignAssets/icon-priority-down.png") as Texture,
  time: requireAsset("../DesignAssets/icon-time.png") as Texture,
  remind: requireAsset("../DesignAssets/icon-remind.png") as Texture,
  more: requireAsset("../DesignAssets/icon-more.png") as Texture,
}
const TEX_CLOUD = requireAsset("../DesignAssets/cloud.png") as Texture
// Los Image creados en runtime no traen material: se clona el del UIKit.
const IMAGE_MATERIAL = requireAsset("../../Packages/SpectaclesUIKit.lspkg/Materials/Image.mat") as Material
// Tipografía handscript del diseño (Cheese Milky) — grande, como en la referencia.
const FONT_HAND = requireAsset("../Fonts/CheeseMilky.otf") as Font
const FONT_SCALE = 1.5

// Página 800×1024 px → 39×50 cm (factor 0.0488 cm/px)
const PAGE_W = 39
const PAGE_H = 50
const ROW_Y = [9.0, 2.2, -4.6, -11.4]
const ROW_W = 25
const ROW_H = 6.9

const CONTROL_COLOR = new vec4(0.96, 0.97, 1.00, 1)
const POSTIT_COLOR = new vec4(1.00, 0.93, 0.55, 1)
const RUNNING_TINT = new vec4(1.0, 0.88, 0.72, 1)
const NORMAL_TINT = new vec4(1, 1, 1, 1)
const TEXT_COLOR = new vec4(0.25, 0.2, 0.35, 1)
const TEXT_SOFT = new vec4(0.42, 0.31, 0.58, 1)

type PlateInternals = {
  roundedRectangle: {gradient: boolean; backgroundColor: vec4; opacity: number}
  _enableInteractionPlane: boolean
  collider: ColliderComponent
  _interactionPlane: {destroy(): void}
}

export interface TaskTextEdit {taskIndex: number; text: string}

@component
export class FocusOrganizerPanelUI extends BaseScriptComponent {
  private readonly editEvent = new Event<TaskTextEdit>()
  private readonly movePriorityEvent = new Event<{taskIndex: number; direction: number}>()
  private readonly reminderEvent = new Event<void>()
  private readonly playEvent = new Event<number>()
  private readonly skipEvent = new Event<number>()
  private readonly doneEvent = new Event<number>()
  private readonly timeEvent = new Event<{taskIndex: number; delta: number}>()
  private readonly noteEvent = new Event<TaskTextEdit>()
  private readonly estimateEvent = new Event<number>()
  private readonly checkInEvent = new Event<boolean>()
  private readonly cardSelectEvent = new Event<number>()

  private cardRoots: SceneObject[] = []
  private cardSummaries: Text[] = []
  private cardPreviews: Text[] = []
  private targets: vec3[] = []
  private targetScales: vec3[] = []
  private detailRoot: SceneObject | null = null
  private taskLabels: Text[] = []
  private rowImages: Image[] = []
  private badgeImages: Image[] = []
  private badgeObjects: SceneObject[] = []
  private playImages: Image[] = []
  private rowHasTask: boolean[] = [false, false, false, false]
  private coachText: Text | null = null
  private reminderLabel: Text | null = null
  private reminderOverlay: Text | null = null
  private reminderMinutesUI = 5
  private timePopup: SceneObject | null = null
  private timePopupMinutes: Text | null = null
  private selectedCard = 0
  private selectedTask = 0
  private scrollOffset = 0
  private cards: readonly FocusCardState[] = []
  private dragShift = 0
  private notePaper: SceneObject | null = null
  private noteTaskIndex = 0
  private noteTitle: Text | null = null
  private noteBody: Text | null = null
  private noteSteps: Text | null = null
  private noteEstimate: Text | null = null
  private rowRoots: SceneObject[] = []
  private controlsRoot: SceneObject | null = null
  private checkInRoot: SceneObject | null = null
  private tunnelIndex: number | null = null
  private chipRoot: SceneObject | null = null
  private chipTitle: Text | null = null
  private chipInfo: Text | null = null
  private chipSnapped = false
  private focusRoot: SceneObject | null = null
  private focusTitle: Text | null = null
  private focusClock: Text | null = null
  private focusNudge: Text | null = null
  private focusActive = false
  private readonly focusPauseEvent = new Event<void>()
  private readonly focusDoneEvent = new Event<void>()

  get onTaskEdited(): PublicApi<TaskTextEdit> { return this.editEvent.publicApi() }
  get onMovePriority(): PublicApi<{taskIndex: number; direction: number}> { return this.movePriorityEvent.publicApi() }
  get onReminderCycle(): PublicApi<void> { return this.reminderEvent.publicApi() }
  get onPlay(): PublicApi<number> { return this.playEvent.publicApi() }
  get onSkip(): PublicApi<number> { return this.skipEvent.publicApi() }
  get onDone(): PublicApi<number> { return this.doneEvent.publicApi() }
  get onTimeDelta(): PublicApi<{taskIndex: number; delta: number}> { return this.timeEvent.publicApi() }
  get onNoteEdited(): PublicApi<TaskTextEdit> { return this.noteEvent.publicApi() }
  get onEstimateRequested(): PublicApi<number> { return this.estimateEvent.publicApi() }
  /** true = "me distraje", false = "sigo" */
  get onCheckIn(): PublicApi<boolean> { return this.checkInEvent.publicApi() }
  get onFocusPause(): PublicApi<void> { return this.focusPauseEvent.publicApi() }
  get onFocusDone(): PublicApi<void> { return this.focusDoneEvent.publicApi() }
  /** Tap en los tabs laterales del cuaderno (HOME / WORK / ME TIME). */
  get onCardSelected(): PublicApi<number> { return this.cardSelectEvent.publicApi() }

  onAwake(): void {
    const authored = this.sceneObject.getTransform().getLocalPosition()
    this.sceneObject.getTransform().setLocalPosition(new vec3(0, authored.y, authored.z))
    this.sceneObject.createComponent("Component.Canvas")
    this.sceneObject.createComponent(Billboard.getTypeName())
    for (let index = 0; index < STR.categories.length; index++) this.createCard(index)
    this.createDetails()
    this.createNotePaper()
    this.createFocusChip()
    this.createFocusView()
    this.updateCarouselTargets()
    this.createEvent("OnStartEvent").bind(() => this.centerHorizontallyInView())
    this.createEvent("UpdateEvent").bind(() => this.animateCarousel())
  }

  render(cards: readonly FocusCardState[], selectedCard: number, selectedTask: number): void {
    this.cards = cards
    const cardChanged = this.selectedCard !== selectedCard
    const taskChanged = this.selectedTask !== selectedTask
    this.selectedCard = selectedCard
    this.selectedTask = selectedTask
    if (cardChanged) this.scrollOffset = 0
    if (taskChanged && selectedTask < this.scrollOffset) this.scrollOffset = selectedTask
    if (taskChanged && selectedTask >= this.scrollOffset + 4) this.scrollOffset = selectedTask - 3
    for (let index = 0; index < cards.length; index++) {
      const done = cards[index].tasks.filter((task) => task.status === "done").length
      this.cardSummaries[index].text = STR.taskCount(cards[index].tasks.length, done)
      this.cardPreviews[index].enabled = index !== selectedCard
      this.cardPreviews[index].text = this.previewTasks(cards[index])
    }
    if (cardChanged && this.detailRoot) {
      this.detailRoot.setParent(this.cardRoots[selectedCard])
      this.detailRoot.getTransform().setLocalPosition(vec3.zero())
      this.detailRoot.getTransform().setLocalScale(vec3.one())
      this.updateCarouselTargets()
    }
    const tasks = cards[selectedCard].tasks
    for (let row = 0; row < 4; row++) this.renderTask(row, tasks[this.scrollOffset + row])
    if (cardChanged) this.closeNotePaper()
    if (cardChanged && this.timePopup) this.timePopup.enabled = false
    if (this.timePopup?.enabled) this.refreshTimePopup()
    if (this.notePaper?.enabled) this.refreshNotePaper()
  }

  setCoach(message: string): void { if (this.coachText) this.coachText.text = message }

  setReminderLabel(minutes: number): void {
    this.reminderMinutesUI = minutes
    if (minutes <= 0) this.setReminderProgress(null)
  }

  /** Countdown "de torta" sobre el icono remind: disco que se achica; rojo al final. */
  setReminderProgress(fraction: number | null): void {
    if (!this.reminderOverlay) return
    const show = fraction !== null && this.reminderMinutesUI > 0
    this.reminderOverlay.getSceneObject().enabled = show
    if (!show || fraction === null) return
    const clamped = Math.max(0.12, Math.min(1, fraction))
    this.reminderOverlay.getSceneObject().getTransform().setLocalScale(new vec3(clamped, clamped, 1))
    this.reminderOverlay.textFill.color = fraction < 0.2 ? new vec4(0.9, 0.25, 0.2, 0.5) : new vec4(0.2, 0.75, 0.35, 0.45)
  }

  scrollTasks(direction: number): void {
    const count = this.cards[this.selectedCard]?.tasks.length ?? 0
    this.scrollOffset = Math.max(0, Math.min(Math.max(0, count - 4), this.scrollOffset + direction))
    const tasks = this.cards[this.selectedCard]?.tasks ?? []
    for (let row = 0; row < 4; row++) this.renderTask(row, tasks[this.scrollOffset + row])
    this.applyTunnel()
  }

  // ——— La página del cuaderno ———

  private createCard(index: number): void {
    const root = this.obj(this.sceneObject, `CarouselCard-${index}`, vec3.zero())
    this.addImage(root, "Page", TEX_PAGES[index % TEX_PAGES.length], new vec3(0, 0, 0), PAGE_W, PAGE_H)
    // Título grande y "bold" (outline del mismo color), inclinado con la cinta.
    const title = this.addText(root, STR.categories[index], new vec3(-5.2, 20.2, 0.7), 75, 14.5, 4.6)
    this.tiltAndBold(title, -25)
    this.addText(root, STR.formatDate(), new vec3(-6.4, 16.5, 0.7), 25, 10.5, 2)
    const summary = this.addText(root, STR.taskCount(0, 0), new vec3(-6, 14.3, 0.7), 25, 13, 1.9)
    // La nube (la IA) con su globito, arriba a la derecha como en el diseño.
    this.addImage(root, "Cloud", TEX_CLOUD, new vec3(8.4, 18.4, 0.6), 12, 9.4)
    const preview = this.addText(root, "", new vec3(-1, 0.5, 0.7), 30, 26, 22)
    // Tabs laterales del cuaderno (horneados en la página) → hotspots invisibles.
    this.addHotspot(root, "TabHome", new vec3(17.6, 14.0, 0.8), 4.6, 7, () => this.cardSelectEvent.invoke(0))
    this.addHotspot(root, "TabWork", new vec3(17.6, 4.3, 0.8), 4.6, 7, () => this.cardSelectEvent.invoke(1))
    this.addHotspot(root, "TabMe", new vec3(17.6, -6.3, 0.8), 4.6, 7, () => this.cardSelectEvent.invoke(2))
    this.cardRoots.push(root)
    this.cardSummaries.push(summary)
    this.cardPreviews.push(preview)
    this.targets.push(vec3.zero())
    this.targetScales.push(vec3.one())
  }

  // ——— Las filas washi + barra de iconos ———

  private createDetails(): void {
    this.detailRoot = this.obj(this.cardRoots[0], "ActiveCardTasks", vec3.zero())
    for (let row = 0; row < 4; row++) {
      // Corridas a la derecha para despegarse del espiral del cuaderno.
      const rowRoot = this.obj(this.detailRoot, `Row-${row}`, new vec3(0.6, ROW_Y[row], 1))
      this.rowRoots.push(rowRoot)
      // La tira washi entera es el botón que abre el post-it de la tarea.
      const strip = this.addImage(rowRoot, "Strip", TEX_WASHI[row % TEX_WASHI.length], new vec3(0, 0, 0), ROW_W, ROW_H)
      this.rowImages[row] = strip.image
      this.makeInteractive(strip.object, ROW_W, ROW_H, () => this.onRowPressed(this.visibleIndex(row)))
      // Texto pegado al círculo blanco y llevado hacia la derecha (menos vacío).
      this.taskLabels[row] = this.addText(rowRoot, "", new vec3(0.4, -0.15, 0.5), 27, 15, 4.8)
      this.taskLabels[row].horizontalAlignment = HorizontalAlignment.Left
      // Badge de prioridad (imagen DO FIRST / NEXT / LATER).
      const badge = this.addImage(rowRoot, "Badge", TEX_BADGES[2], new vec3(6.2, -1.5, 0.5), 5.6, 1.85)
      this.badgeImages[row] = badge.image
      this.badgeObjects[row] = badge.object
      // Play redondo del color de la fila, con "mouseover" que lo agranda.
      const play = this.addImage(rowRoot, "Play", TEX_PLAY[row % TEX_PLAY.length], new vec3(10.1, 0, 0.5), 3.4, 3.3)
      this.playImages[row] = play.image
      const playBaseScale = play.object.getTransform().getLocalScale()
      const playInteractable = this.makeInteractive(play.object, 3.8, 3.8, () => { const i = this.visibleIndex(row); this.selectedTask = i; this.playEvent.invoke(i) })
      playInteractable.onHoverEnter.add(() => play.object.getTransform().setLocalScale(playBaseScale.uniformScale(1.2)))
      playInteractable.onHoverExit.add(() => play.object.getTransform().setLocalScale(playBaseScale))
      // Hotspot sobre el checkbox horneado (izquierda de la tira) → completar.
      this.addHotspot(rowRoot, `Done-${row}`, new vec3(-9.9, 0.4, 0.6), 2.8, 2.8, () => { const i = this.visibleIndex(row); this.selectedTask = i; this.doneEvent.invoke(i) })
    }
    // "+ Add a task" punteado, como en el diseño.
    const addTask = this.addImage(this.detailRoot, "AddTask", TEX_ADD_TASK, new vec3(-0.7, -16.4, 1), 20.5, 3)
    this.makeInteractive(addTask.object, 20.5, 3, () => this.openFirstEmpty())
    // Barra inferior lila (horneada en la página) con los 6 iconos redondos.
    this.controlsRoot = this.obj(this.detailRoot, "Controls", new vec3(0, 0, 1))
    const iconY = -20.1
    const icons: [string, Texture, () => void][] = [
      ["IconAdd", TEX_ICONS.add, () => this.openFirstEmpty()],
      ["IconPriUp", TEX_ICONS.priorityUp, () => this.movePriorityEvent.invoke({taskIndex: this.selectedTask, direction: -1})],
      ["IconPriDown", TEX_ICONS.priorityDown, () => this.movePriorityEvent.invoke({taskIndex: this.selectedTask, direction: 1})],
      ["IconTime", TEX_ICONS.time, () => this.toggleTimePopup()],
      ["IconRemind", TEX_ICONS.remind, () => this.reminderEvent.invoke()],
      ["IconMore", TEX_ICONS.more, () => this.showMoreTasks()],
    ]
    // Centrados y bien adentro de la barra; todos con la MISMA altura visual
    // (el ancho sale de la proporción de cada PNG, así add/more no quedan gigantes).
    const startX = -11.5
    const iconHeight = 3.9
    for (let i = 0; i < icons.length; i++) {
      const [name, tex, action] = icons[i]
      const iconWidth = iconHeight / Math.max(0.001, this.aspectOf(tex))
      const icon = this.addImage(this.controlsRoot, name, tex, new vec3(startX + i * 4.6, iconY, 0.4), iconWidth)
      this.makeInteractive(icon.object, 4.2, 4.4, action)
    }
    // Countdown sobre el propio icono remind: disco transparente que se achica.
    this.reminderOverlay = this.addText(this.controlsRoot, "●", new vec3(6.9, iconY + 0.25, 0.6), 60, 4, 4)
    this.reminderOverlay.textFill.color = new vec4(0.2, 0.75, 0.35, 0.45)
    this.reminderOverlay.getSceneObject().enabled = false
    // El coach habla desde el globito de la nube (arriba a la derecha),
    // con texto grande e inclinado acompañando al globo.
    this.coachText = this.addText(this.detailRoot, STR.coachStart, new vec3(5.7, 20.4, 0.9), 21, 6.4, 4.6)
    this.coachText.horizontalOverflow = HorizontalOverflow.Wrap
    this.tilt(this.coachText, -25)
    // Popup de tiempo: total manual + estimación con IA, para la tarea seleccionada.
    this.timePopup = this.obj(this.detailRoot, "TimePopup", new vec3(0, -6, 3))
    const timePlate = this.timePopup.createComponent(BackPlate.getTypeName()) as BackPlate
    timePlate.size = new vec2(18, 13)
    timePlate.style = "simple"
    this.tint(timePlate, CONTROL_COLOR)
    this.makeDecorative(timePlate)
    this.addText(this.timePopup, STR.timePopupTitle, new vec3(-1.2, 4.6, 0.6), 24, 12, 2.4)
    this.addSurfaceButton(this.timePopup, "TimeClose", "✕", new vec3(7.4, 4.6, 0.6), 2.6, 2.4, () => { if (this.timePopup) this.timePopup.enabled = false })
    this.timePopupMinutes = this.addText(this.timePopup, "15 min", new vec3(0, 1.6, 0.6), 34, 10, 3)
    this.addSurfaceButton(this.timePopup, "TimeM5", "−5", new vec3(-6.3, -1.4, 0.6), 3.4, 2.8, () => this.timeEvent.invoke({taskIndex: this.selectedTask, delta: -5}))
    this.addSurfaceButton(this.timePopup, "TimeM1", "−1", new vec3(-2.2, -1.4, 0.6), 3.4, 2.8, () => this.timeEvent.invoke({taskIndex: this.selectedTask, delta: -1}))
    this.addSurfaceButton(this.timePopup, "TimeP1", "+1", new vec3(1.9, -1.4, 0.6), 3.4, 2.8, () => this.timeEvent.invoke({taskIndex: this.selectedTask, delta: 1}))
    this.addSurfaceButton(this.timePopup, "TimeP5", "+5", new vec3(6, -1.4, 0.6), 3.4, 2.8, () => this.timeEvent.invoke({taskIndex: this.selectedTask, delta: 5}))
    this.addSurfaceButton(this.timePopup, "TimeAI", STR.estimateAI, new vec3(0, -4.7, 0.6), 14, 3, () => { this.estimateEvent.invoke(this.selectedTask); if (this.timePopup) this.timePopup.enabled = false })
    this.timePopup.enabled = false
    this.checkInRoot = this.obj(this.detailRoot, "CheckIn", new vec3(0, -14.2, 3))
    this.addSurfaceButton(this.checkInRoot, "CheckFocused", STR.checkFocused, new vec3(-5.6, 0, 0), 8, 3.6, () => { this.hideCheckIn(); this.checkInEvent.invoke(false) })
    this.addSurfaceButton(this.checkInRoot, "CheckDrifted", STR.checkDrifted, new vec3(5.6, 0, 0), 10.5, 3.6, () => { this.hideCheckIn(); this.checkInEvent.invoke(true) })
    this.checkInRoot.enabled = false
  }

  private toggleTimePopup(): void {
    if (!this.timePopup) return
    this.timePopup.enabled = !this.timePopup.enabled
    if (this.timePopup.enabled) this.refreshTimePopup()
  }

  private refreshTimePopup(): void {
    const task = this.cards[this.selectedCard]?.tasks[this.selectedTask]
    if (this.timePopupMinutes) this.timePopupMinutes.text = task ? `${task.durationMinutes} min` : "—"
  }

  // "more" = ver más tareas: baja por la lista y al llegar al final vuelve al inicio.
  private showMoreTasks(): void {
    const count = this.cards[this.selectedCard]?.tasks.length ?? 0
    if (count <= 4) return
    if (this.scrollOffset >= count - 4) {
      this.scrollOffset = -1
      this.scrollTasks(1)
    } else {
      this.scrollTasks(1)
    }
  }

  // ——— Focus Mode: espacio visual limpio — solo la tarea y el reloj ———

  private createFocusView(): void {
    this.focusRoot = this.obj(this.sceneObject, "FocusView", new vec3(0, 0, 2))
    this.focusTitle = this.addText(this.focusRoot, "", new vec3(0, 8, 0), 64, 44, 5)
    this.focusClock = this.addText(this.focusRoot, "", new vec3(0, 0, 0), 46, 44, 4)
    this.focusNudge = this.addText(this.focusRoot, "", new vec3(0, -7, 0), 30, 40, 3)
    this.addSurfaceButton(this.focusRoot, "FocusPause", STR.focusPause, new vec3(-6.5, -16, 0), 9, 3.2, () => this.focusPauseEvent.invoke())
    this.addSurfaceButton(this.focusRoot, "FocusDone", STR.focusDone, new vec3(6.5, -16, 0), 9, 3.2, () => this.focusDoneEvent.invoke())
    this.focusRoot.enabled = false
  }

  setFocusMode(active: boolean): void {
    if (this.focusActive === active) return
    this.focusActive = active
    if (this.focusRoot) this.focusRoot.enabled = active
    if (active) {
      this.closeNotePaper()
      this.hideCheckIn()
      if (this.timePopup) this.timePopup.enabled = false
      if (this.focusNudge) this.focusNudge.text = ""
      for (const root of this.cardRoots) root.enabled = false
    } else {
      this.updateCarouselTargets()
    }
  }

  renderFocus(title: string, remainingSeconds: number): void {
    if (!this.focusActive) return
    if (this.focusTitle) this.focusTitle.text = title
    const minutes = Math.floor(remainingSeconds / 60)
    const seconds = Math.floor(remainingSeconds % 60)
    if (this.focusClock) this.focusClock.text = STR.focusRemaining(`${minutes}:${seconds < 10 ? "0" : ""}${seconds}`)
  }

  showFocusNudge(message: string): void {
    if (this.focusNudge) this.focusNudge.text = message
  }

  clearFocusNudge(): void {
    if (this.focusNudge) this.focusNudge.text = ""
  }

  // ——— La nube que te acompaña: chip de foco en la periferia ———

  private createFocusChip(): void {
    // Hija del panel para heredar el contexto de render; su posición se pisa
    // cada frame en coordenadas de mundo para seguir a la cámara.
    this.chipRoot = this.obj(this.sceneObject, "FocusChip", vec3.zero())
    this.addImage(this.chipRoot, "CloudChip", TEX_CLOUD, new vec3(0, 0, 0), 13)
    // Los textos van sobre el globito de la nube, grandes e inclinados con él.
    this.chipTitle = this.addText(this.chipRoot, "", new vec3(-2.6, 2.4, 0.5), 17, 5.6, 2.4)
    this.chipTitle.horizontalOverflow = HorizontalOverflow.Wrap
    this.tilt(this.chipTitle, -25)
    this.chipInfo = this.addText(this.chipRoot, "", new vec3(-2.6, 0.6, 0.5), 15, 5.6, 1.9)
    this.tilt(this.chipInfo, -25)
    this.chipRoot.enabled = false
  }

  updateFocusChip(data: {title: string; remainingSeconds: number; step: string | null} | null): void {
    if (!this.chipRoot) return
    if (!data) {
      this.chipRoot.enabled = false
      this.chipSnapped = false
      return
    }
    this.chipRoot.enabled = true
    if (this.chipTitle) this.chipTitle.text = data.title.length > 16 ? data.title.substring(0, 15) + "…" : data.title
    const minutes = Math.floor(data.remainingSeconds / 60)
    const seconds = Math.floor(data.remainingSeconds % 60)
    if (this.chipInfo) this.chipInfo.text = `⏱ ${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
    this.followCamera()
  }

  private followCamera(): void {
    if (!this.chipRoot?.enabled) return
    const camTransform = WorldCameraFinderProvider.getInstance().getTransform()
    // OJO: transform.forward apunta al +Z local (la ESPALDA de la vista) — se niega.
    const target = camTransform.getWorldPosition()
      .add(camTransform.forward.uniformScale(-40))
      .add(camTransform.right.uniformScale(8))
      .add(camTransform.up.uniformScale(-6))
    const transform = this.chipRoot.getTransform()
    if (!this.chipSnapped) {
      this.chipSnapped = true
      transform.setWorldPosition(target)
    } else {
      const current = transform.getWorldPosition()
      transform.setWorldPosition(current.add(target.sub(current).uniformScale(Math.min(1, getDeltaTime() * 4))))
    }
    // Misma orientación que el panel (que ya sabemos que se lee bien).
    transform.setWorldRotation(this.sceneObject.getTransform().getWorldRotation())
  }

  // ——— Check-in de deriva ———

  showCheckIn(): void { if (this.checkInRoot) this.checkInRoot.enabled = true }
  hideCheckIn(): void { if (this.checkInRoot) this.checkInRoot.enabled = false }

  // ——— Modo túnel: una tarea corriendo = menos ruido visual ———

  setTunnel(runningTaskIndex: number | null): void {
    const changed = this.tunnelIndex !== runningTaskIndex
    this.tunnelIndex = runningTaskIndex
    this.applyTunnel()
    if (changed) this.updateCarouselTargets()
  }

  private applyTunnel(): void {
    if (this.controlsRoot) this.controlsRoot.enabled = this.tunnelIndex === null
    for (let row = 0; row < this.rowRoots.length; row++) {
      const tunnelOk = this.tunnelIndex === null || this.visibleIndex(row) === this.tunnelIndex
      this.rowRoots[row].enabled = this.rowHasTask[row] && tunnelOk
    }
  }

  // ——— Papelito de tarea: notas + estimación IA ———

  private createNotePaper(): void {
    // Post-it: chico, cuadrado, apenas inclinado como pegado a mano sobre la card.
    this.notePaper = this.obj(this.sceneObject, "NotePaper", new vec3(10, 5, 6))
    this.notePaper.getTransform().setLocalRotation(quat.angleAxis(-0.05, new vec3(0, 0, 1)))
    const plate = this.notePaper.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(23, 24)
    plate.style = "simple"
    this.tint(plate, POSTIT_COLOR)
    this.makeDecorative(plate)
    this.noteTitle = this.addText(this.notePaper, "", new vec3(-2.5, 9.3, 0.7), 27, 13.5, 2.6)
    this.addSurfaceButton(this.notePaper, "EditTitle", "✏", new vec3(5.6, 9.3, 0.7), 2.8, 2.6, () => this.openKeyboard(this.noteTaskIndex))
    this.addSurfaceButton(this.notePaper, "NoteClose", "✕", new vec3(9.2, 9.3, 0.7), 2.8, 2.6, () => this.closeNotePaper())
    this.noteBody = this.addSurfaceButton(this.notePaper, "NoteBody", "", new vec3(0, 3.5, 0.7), 20, 7.5, () => this.openNoteKeyboard())
    this.noteSteps = this.addText(this.notePaper, "", new vec3(0, -3.2, 0.7), 18, 20, 5.6)
    // Ajuste fino de a 1 minuto en el post-it; el ajuste grueso de ±5 vive en la card.
    this.addSurfaceButton(this.notePaper, "NoteMinus", "−", new vec3(-8.7, -8.2, 0.7), 2.6, 2.8, () => this.timeEvent.invoke({taskIndex: this.noteTaskIndex, delta: -1}))
    this.noteEstimate = this.addText(this.notePaper, "⏱ 15m", new vec3(-4.6, -8.2, 0.7), 24, 5.2, 2.8)
    this.addSurfaceButton(this.notePaper, "NotePlus", "+", new vec3(-0.5, -8.2, 0.7), 2.6, 2.8, () => this.timeEvent.invoke({taskIndex: this.noteTaskIndex, delta: 1}))
    this.addSurfaceButton(this.notePaper, "NoteEstimate", STR.estimateButton, new vec3(5.9, -8.2, 0.7), 8.6, 2.8, () => this.estimateEvent.invoke(this.noteTaskIndex))
    this.notePaper.enabled = false
  }

  private onRowPressed(index: number): void {
    this.selectedTask = index
    const task = this.cards[this.selectedCard]?.tasks[index]
    if (task) this.openNotePaper(index)
    else this.openKeyboard(index)
  }

  private openNotePaper(index: number): void {
    this.noteTaskIndex = index
    this.refreshNotePaper()
    if (this.notePaper) this.notePaper.enabled = true
  }

  private closeNotePaper(): void {
    if (this.notePaper) this.notePaper.enabled = false
  }

  private refreshNotePaper(): void {
    const task = this.cards[this.selectedCard]?.tasks[this.noteTaskIndex]
    if (!task) { this.closeNotePaper(); return }
    if (this.noteTitle) this.noteTitle.text = task.title.length > 16 ? task.title.substring(0, 15) + "…" : task.title
    if (this.noteBody) this.noteBody.text = task.note.length > 0 ? task.note : STR.notePlaceholder
    if (this.noteSteps) this.noteSteps.text = task.aiSteps.map((step) => `· ${step}`).join("\n")
    if (this.noteEstimate) this.noteEstimate.text = `⏱ ${task.durationMinutes}m`
  }

  private openNoteKeyboard(): void {
    require("LensStudio:TextInputModule")
    let value = this.cards[this.selectedCard]?.tasks[this.noteTaskIndex]?.note ?? ""
    const options = new TextInputSystem.KeyboardOptions()
    options.enablePreview = true
    options.keyboardType = TextInputSystem.KeyboardType.Text
    options.returnKeyType = TextInputSystem.ReturnKeyType.Done
    options.initialText = value
    options.onTextChanged = (text: string) => { value = text }
    options.onReturnKeyPressed = () => { this.noteEvent.invoke({taskIndex: this.noteTaskIndex, text: value}); global.textInputSystem.dismissKeyboard() }
    options.onError = (code: number, description: string) => print(`[Keyboard] ${code}: ${description}`)
    global.textInputSystem.requestKeyboard(options)
  }

  private renderTask(row: number, task?: FocusTaskState): void {
    this.rowHasTask[row] = !!task
    if (!task) {
      this.applyTunnel()
      return
    }
    const actualIndex = this.scrollOffset + row
    const minutes = Math.floor(task.remainingSeconds / 60)
    const seconds = Math.floor(task.remainingSeconds % 60)
    const clock = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
    const status = task.status === "done" ? " ✓" : task.status === "skipped" ? " ↷" : ""
    const selected = actualIndex === this.selectedTask ? "● " : ""
    this.taskLabels[row].text = `${selected}${this.short(task.title)}\n⏱ ${clock}${status}`
    if (this.badgeObjects[row]) this.badgeObjects[row].enabled = task.status !== "done"
    if (this.badgeImages[row] && this.badgeObjects[row]) {
      const badgeTex = TEX_BADGES[Math.min(task.priority - 1, TEX_BADGES.length - 1)]
      this.badgeImages[row].mainPass.baseTex = badgeTex
      this.badgeObjects[row].getTransform().setLocalScale(new vec3(5.6, 5.6 * this.aspectOf(badgeTex), 1))
    }
    if (this.rowImages[row]) this.rowImages[row].mainPass.baseColor = task.status === "running" ? RUNNING_TINT : NORMAL_TINT
    if (this.playImages[row]) this.playImages[row].mainPass.baseColor = task.status === "running" ? new vec4(0.75, 0.75, 0.75, 1) : NORMAL_TINT
    this.applyTunnel()
  }

  setCarouselDrag(progress: number): void {
    this.dragShift = Math.max(-1.2, Math.min(1.2, progress))
    this.updateCarouselTargets()
  }

  private updateCarouselTargets(): void {
    if (this.focusActive) {
      for (const root of this.cardRoots) root.enabled = false
      return
    }
    const count = this.cardRoots.length
    // El arrastre corre todo el carrusel de forma continua; al soltar, el snap
    // cambia selectedCard y las cards ya están casi en su lugar (sin salto).
    // En modo túnel solo queda la card activa: menos invitaciones a distraerse.
    const maxNeighbors = this.tunnelIndex !== null ? 0 : 2
    const shiftX = this.dragShift * 34
    const centerBlend = Math.min(1, Math.abs(this.dragShift))
    for (let index = 0; index < count; index++) {
      let diff = (index - this.selectedCard + count) % count
      if (diff > count / 2) diff -= count
      const abs = Math.abs(diff)
      this.cardRoots[index].enabled = abs <= maxNeighbors
      if (abs === 0) {
        this.targets[index] = new vec3(shiftX, 1.5 * centerBlend, -13 * centerBlend)
        const scale = 1 - 0.24 * centerBlend
        this.targetScales[index] = new vec3(scale, scale, scale)
        this.cardRoots[index].getTransform().setLocalRotation(quat.quatIdentity())
      } else if (abs === 1) {
        const towardCenter = Math.sign(-diff) === Math.sign(this.dragShift) ? centerBlend : 0
        this.targets[index] = new vec3(diff * 34 + shiftX, 1.5 * (1 - towardCenter), -13 * (1 - towardCenter))
        const scale = 0.76 + 0.24 * towardCenter
        this.targetScales[index] = new vec3(scale, scale, scale)
        this.cardRoots[index].getTransform().setLocalRotation(quat.angleAxis(-diff * 0.16 * (1 - towardCenter), vec3.up()))
      } else {
        this.targets[index] = new vec3(diff * 29 + shiftX, 2.5, -26)
        this.targetScales[index] = new vec3(0.52, 0.52, 0.52)
        this.cardRoots[index].getTransform().setLocalRotation(quat.angleAxis(-diff * 0.22, vec3.up()))
      }
    }
  }

  private animateCarousel(): void {
    this.followCamera()
    const amount = Math.min(1, getDeltaTime() * 9)
    for (let index = 0; index < this.cardRoots.length; index++) {
      if (!this.cardRoots[index].enabled) continue
      const transform = this.cardRoots[index].getTransform()
      const pos = transform.getLocalPosition()
      const scale = transform.getLocalScale()
      transform.setLocalPosition(pos.add(this.targets[index].sub(pos).uniformScale(amount)))
      transform.setLocalScale(scale.add(this.targetScales[index].sub(scale).uniformScale(amount)))
    }
  }

  private centerHorizontallyInView(): void {
    const panelTransform = this.sceneObject.getTransform()
    const panelPosition = panelTransform.getWorldPosition()
    const cameraTransform = WorldCameraFinderProvider.getInstance().getComponent().getTransform()
    const cameraPosition = cameraTransform.getWorldPosition()
    const forward = cameraTransform.forward
    if (Math.abs(forward.z) < 0.001) return
    const distanceToPlane = (panelPosition.z - cameraPosition.z) / forward.z
    const gazeCenter = cameraPosition.add(forward.uniformScale(distanceToPlane))
    panelTransform.setWorldPosition(new vec3(gazeCenter.x, panelPosition.y, panelPosition.z))
    print(`[FocusOrganizer] panel centrado en la mirada: x=${gazeCenter.x.toFixed(2)}`)
  }

  private openFirstEmpty(): void {
    this.openKeyboard(this.cards[this.selectedCard]?.tasks.length ?? 0)
  }

  private openKeyboard(row: number): void {
    this.selectedTask = row
    require("LensStudio:TextInputModule")
    let value = this.cards[this.selectedCard]?.tasks[row]?.title ?? ""
    const options = new TextInputSystem.KeyboardOptions()
    options.enablePreview = true
    options.keyboardType = TextInputSystem.KeyboardType.Text
    options.returnKeyType = TextInputSystem.ReturnKeyType.Done
    options.initialText = value
    options.onTextChanged = (text: string) => { value = text }
    options.onReturnKeyPressed = () => { this.editEvent.invoke({taskIndex: row, text: value}); global.textInputSystem.dismissKeyboard() }
    options.onError = (code: number, description: string) => print(`[Keyboard] ${code}: ${description}`)
    global.textInputSystem.requestKeyboard(options)
  }

  // ——— Helpers visuales ———

  private addImage(parent: SceneObject, name: string, texture: Texture, position: vec3, width: number, _height?: number): {object: SceneObject; image: Image} {
    const object = this.obj(parent, name, position)
    // La altura sale SIEMPRE de la proporción real del PNG: nada se deforma.
    object.getTransform().setLocalScale(new vec3(width, width * this.aspectOf(texture), 1))
    const image = object.createComponent("Component.Image") as Image
    image.mainMaterial = IMAGE_MATERIAL.clone() as Material
    image.mainPass.baseTex = texture
    return {object, image}
  }

  private aspectOf(texture: Texture): number {
    const w = texture.getWidth()
    return w > 0 ? texture.getHeight() / w : 1
  }

  /** Zona interactiva invisible (para elementos horneados en las imágenes). */
  private addHotspot(parent: SceneObject, name: string, position: vec3, width: number, height: number, press: () => void): void {
    const object = this.obj(parent, name, position)
    this.makeInteractive(object, width, height, press)
  }

  private makeInteractive(object: SceneObject, width: number, height: number, press: () => void): Interactable {
    const collider = object.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    // Si el objeto está escalado (imágenes), el collider hereda la escala → compensar.
    const scale = object.getTransform().getLocalScale()
    shape.size = new vec3(width / Math.max(0.001, scale.x), height / Math.max(0.001, scale.y), 4)
    collider.shape = shape
    const interactable = object.createComponent(Interactable.getTypeName()) as Interactable
    interactable.onTriggerEnd.add(press)
    return interactable
  }

  /** Inclina un texto para que acompañe a su contenedor dibujado. */
  private tilt(text: Text, degrees: number): void {
    text.getSceneObject().getTransform().setLocalRotation(quat.angleAxis((degrees * Math.PI) / 180, new vec3(0, 0, 1)))
  }

  /** Título: inclinado + "bold" simulado con contorno del mismo color. */
  private tiltAndBold(text: Text, degrees: number): void {
    this.tilt(text, degrees)
    text.outlineSettings.enabled = true
    text.outlineSettings.size = 0.14
    text.outlineSettings.fill.color = TEXT_COLOR
  }

  private addSurfaceButton(parent: SceneObject, name: string, label: string, position: vec3, width: number, height: number, press: () => void, capturePlate?: (plate: BackPlate) => void): Text {
    const object = this.obj(parent, name, position)
    const plate = object.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(width, height)
    plate.style = "simple"
    this.tint(plate, CONTROL_COLOR)
    if (capturePlate) capturePlate(plate)
    this.disableInteractionPlane(plate)
    plate.onInitialized.add(() => plate.interactable.onTriggerEnd.add(press))
    return this.addText(object, label, new vec3(0, 0, 0.65), 31, width - 0.7, height - 0.5)
  }

  private addText(parent: SceneObject, value: string, position: vec3, size: number, width: number, height: number): Text {
    const object = this.obj(parent, "Text", position)
    const text = object.createComponent("Component.Text") as Text
    text.text = value; text.size = Math.round(size * FONT_SCALE); text.depthTest = true
    text.font = FONT_HAND
    text.textFill.color = TEXT_COLOR
    text.horizontalAlignment = HorizontalAlignment.Center; text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = HorizontalOverflow.Shrink; text.verticalOverflow = VerticalOverflow.Shrink
    text.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
    return text
  }

  private tint(plate: BackPlate, color: vec4): void {
    if (!plate) return
    // BackPlate applies its built-in dark style during initialize(). Tinting the
    // RoundedRectangle before that point is silently overwritten, which makes
    // black/gray appear transparent on optical see-through displays.
    plate.onInitialized.add(() => {
      const p = plate as unknown as PlateInternals
      p.roundedRectangle.gradient = false
      p.roundedRectangle.backgroundColor = color
      p.roundedRectangle.opacity = 1
    })
  }
  private disableInteractionPlane(plate: BackPlate): void { ;(plate as unknown as PlateInternals)._enableInteractionPlane = false }
  private makeDecorative(plate: BackPlate): void {
    this.disableInteractionPlane(plate)
    plate.onInitialized.add(() => { const p = plate as unknown as PlateInternals; p.collider.destroy(); p._interactionPlane.destroy(); plate.interactable.destroy() })
  }
  private short(value: string): string { return value.length > 18 ? value.substring(0, 17) + "…" : value }
  private visibleIndex(row: number): number { return this.scrollOffset + row }
  // Las tareas se ven desde el carrusel: lista tipo checklist en las cards vecinas.
  private previewTasks(card: FocusCardState): string {
    if (card.tasks.length === 0) return STR.addFirstTask
    const lines = card.tasks.slice(0, 6).map((task) => {
      const mark = task.status === "done" ? "✓" : task.status === "running" ? "▶" : task.status === "skipped" ? "↷" : "○"
      return `${mark}  ${this.short(task.title)}`
    })
    if (card.tasks.length > 6) lines.push(STR.more(card.tasks.length - 6))
    return lines.join("\n")
  }
  private obj(parent: SceneObject, name: string, position: vec3): SceneObject {
    const object = global.scene.createSceneObject(name); object.setParent(parent); object.getTransform().setLocalPosition(position); return object
  }
}
