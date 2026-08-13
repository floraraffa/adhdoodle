import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FocusCardState, FocusTaskState} from "./FocusOrganizerState"

const CARD_WIDTH = 44
const CARD_HEIGHT = 46
const ROW_Y = [9, 3, -3, -9]
const COLORS = [
  new vec4(0.67, 0.81, 1.00, 1), new vec4(0.84, 0.73, 0.97, 1),
  new vec4(0.65, 0.91, 0.84, 1), new vec4(1.00, 0.79, 0.63, 1),
  new vec4(0.98, 0.72, 0.83, 1), new vec4(0.85, 0.92, 0.64, 1),
]

const CONTROL_COLOR = new vec4(0.96, 0.97, 1.00, 1)
const POSTIT_COLOR = new vec4(1.00, 0.93, 0.55, 1)
const SELECTED_ROW_COLOR = new vec4(0.84, 0.91, 1.00, 1)
const RUNNING_ROW_COLOR = new vec4(1.00, 0.86, 0.58, 1)
const TEXT_COLOR = new vec4(0.42, 0.31, 0.58, 1)

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

  private cardRoots: SceneObject[] = []
  private cardSummaries: Text[] = []
  private cardPreviews: Text[] = []
  private targets: vec3[] = []
  private targetScales: vec3[] = []
  private detailRoot: SceneObject | null = null
  private taskLabels: Text[] = []
  private taskPlates: BackPlate[] = []
  private priorityLabels: Text[] = []
  private playLabels: Text[] = []
  private coachText: Text | null = null
  private reminderLabel: Text | null = null
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

  get onTaskEdited(): PublicApi<TaskTextEdit> { return this.editEvent.publicApi() }
  get onMovePriority(): PublicApi<{taskIndex: number; direction: number}> { return this.movePriorityEvent.publicApi() }
  get onReminderCycle(): PublicApi<void> { return this.reminderEvent.publicApi() }
  get onPlay(): PublicApi<number> { return this.playEvent.publicApi() }
  get onSkip(): PublicApi<number> { return this.skipEvent.publicApi() }
  get onDone(): PublicApi<number> { return this.doneEvent.publicApi() }
  get onTimeDelta(): PublicApi<{taskIndex: number; delta: number}> { return this.timeEvent.publicApi() }
  get onNoteEdited(): PublicApi<TaskTextEdit> { return this.noteEvent.publicApi() }
  get onEstimateRequested(): PublicApi<number> { return this.estimateEvent.publicApi() }

  onAwake(): void {
    const authored = this.sceneObject.getTransform().getLocalPosition()
    this.sceneObject.getTransform().setLocalPosition(new vec3(0, authored.y, authored.z))
    this.sceneObject.createComponent("Component.Canvas")
    this.sceneObject.createComponent(Billboard.getTypeName())
    for (let index = 0; index < 6; index++) this.createCard(index)
    this.createDetails()
    this.createNotePaper()
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
      this.cardSummaries[index].text = `${cards[index].tasks.length} tareas · ${done} hechas`
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
    if (this.notePaper?.enabled) this.refreshNotePaper()
  }

  setCoach(message: string): void { if (this.coachText) this.coachText.text = message }
  setReminderLabel(minutes: number): void { if (this.reminderLabel) this.reminderLabel.text = minutes > 0 ? `🔔 ${minutes}m` : "🔕 off" }

  scrollTasks(direction: number): void {
    const count = this.cards[this.selectedCard]?.tasks.length ?? 0
    this.scrollOffset = Math.max(0, Math.min(Math.max(0, count - 4), this.scrollOffset + direction))
    const tasks = this.cards[this.selectedCard]?.tasks ?? []
    for (let row = 0; row < 4; row++) this.renderTask(row, tasks[this.scrollOffset + row])
  }

  private createCard(index: number): void {
    const root = this.obj(this.sceneObject, `CarouselCard-${index}`, vec3.zero())
    const plate = root.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(CARD_WIDTH, CARD_HEIGHT)
    plate.style = "simple"
    this.tint(plate, COLORS[index])
    this.makeDecorative(plate)
    this.addText(root, ["Trabajo", "Casa", "Relax", "Comida + bienestar", "Amigos", "Hiperfoco"][index], new vec3(0, 19.2, 0.7), 58, 39, 3)
    const summary = this.addText(root, "0 tareas", new vec3(0, 15.7, 0.7), 31, 36, 2)
    const preview = this.addText(root, "", new vec3(0, 0.5, 0.7), 36, 34, 23)
    this.cardRoots.push(root)
    this.cardSummaries.push(summary)
    this.cardPreviews.push(preview)
    this.targets.push(vec3.zero())
    this.targetScales.push(vec3.one())
  }

  private createDetails(): void {
    this.detailRoot = this.obj(this.cardRoots[0], "ActiveCardTasks", vec3.zero())
    for (let row = 0; row < 4; row++) {
      const y = ROW_Y[row]
      this.taskLabels[row] = this.addSurfaceButton(this.detailRoot, `Task-${row}`, "+ Agregar tarea", new vec3(-9, y, 1), 20, 4.8, () => this.onRowPressed(this.visibleIndex(row)), (plate) => { this.taskPlates[row] = plate })
      this.priorityLabels[row] = this.addSurfaceButton(this.detailRoot, `Priority-${row}`, "P2", new vec3(3.2, y, 1), 3.8, 4.2, () => { this.selectedTask = this.visibleIndex(row) })
      this.playLabels[row] = this.addSurfaceButton(this.detailRoot, `Play-${row}`, "▶", new vec3(7.3, y, 1), 3.8, 4.2, () => { const i = this.visibleIndex(row); this.selectedTask = i; this.playEvent.invoke(i) })
      this.addSurfaceButton(this.detailRoot, `Skip-${row}`, "Pasar", new vec3(12.3, y, 1), 5.8, 4.2, () => { const i = this.visibleIndex(row); this.selectedTask = i; this.skipEvent.invoke(i) })
      this.addSurfaceButton(this.detailRoot, `Done-${row}`, "✓", new vec3(17.5, y, 1), 4.2, 4.2, () => { const i = this.visibleIndex(row); this.selectedTask = i; this.doneEvent.invoke(i) })
    }
    this.addSurfaceButton(this.detailRoot, "NewTask", "+ tarea", new vec3(-17, -15, 1), 7.5, 3.5, () => this.openFirstEmpty())
    this.addSurfaceButton(this.detailRoot, "PriorityUp", "↑ prioridad", new vec3(-9, -15, 1), 7.2, 3.5, () => this.movePriorityEvent.invoke({taskIndex: this.selectedTask, direction: -1}))
    this.addSurfaceButton(this.detailRoot, "PriorityDown", "↓ prioridad", new vec3(-1.2, -15, 1), 7.2, 3.5, () => this.movePriorityEvent.invoke({taskIndex: this.selectedTask, direction: 1}))
    this.addSurfaceButton(this.detailRoot, "MinusTime", "−5m", new vec3(5.2, -15, 1), 5, 3.5, () => this.timeEvent.invoke({taskIndex: this.selectedTask, delta: -5}))
    this.addSurfaceButton(this.detailRoot, "PlusTime", "+5m", new vec3(10.7, -15, 1), 5, 3.5, () => this.timeEvent.invoke({taskIndex: this.selectedTask, delta: 5}))
    this.reminderLabel = this.addSurfaceButton(this.detailRoot, "Reminder", "🔔 5m", new vec3(17.3, -15, 1), 7, 3.5, () => this.reminderEvent.invoke())
    this.addSurfaceButton(this.detailRoot, "ScrollUp", "↑ lista", new vec3(-8, -18.5, 1), 6.5, 2.6, () => this.scrollTasks(-1))
    this.addText(this.detailRoot, "índice ↔ cards", new vec3(0, -18.5, 1), 26, 8.5, 1.5)
    this.addSurfaceButton(this.detailRoot, "ScrollDown", "↓ lista", new vec3(8, -18.5, 1), 6.5, 2.6, () => this.scrollTasks(1))
    this.coachText = this.addText(this.detailRoot, "Elegí una tarea y presioná ▶", new vec3(0, -20.7, 1), 29, 38, 2)
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
    this.noteTitle = this.addText(this.notePaper, "", new vec3(-1.5, 9.3, 0.7), 27, 16, 2.6)
    this.addSurfaceButton(this.notePaper, "EditTitle", "✏", new vec3(8.5, 9.3, 0.7), 3, 2.8, () => this.openKeyboard(this.noteTaskIndex))
    this.noteBody = this.addSurfaceButton(this.notePaper, "NoteBody", "", new vec3(0, 3.5, 0.7), 20, 7.5, () => this.openNoteKeyboard())
    this.noteSteps = this.addText(this.notePaper, "", new vec3(0, -3.2, 0.7), 18, 20, 5.6)
    this.noteEstimate = this.addText(this.notePaper, "⏱ 15 min", new vec3(-6.5, -8.2, 0.7), 24, 7, 2.8)
    this.addSurfaceButton(this.notePaper, "NoteEstimate", "✨", new vec3(1, -8.2, 0.7), 3.6, 2.8, () => this.estimateEvent.invoke(this.noteTaskIndex))
    this.addSurfaceButton(this.notePaper, "NoteClose", "✕", new vec3(7.5, -8.2, 0.7), 3.2, 2.8, () => this.closeNotePaper())
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
    if (this.noteBody) this.noteBody.text = task.note.length > 0 ? task.note : "Tocá y anotá\ntus pasos…"
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
    if (!task) {
      this.taskLabels[row].text = "+ Agregar tarea"
      this.priorityLabels[row].text = "—"
      this.playLabels[row].text = "▶"
      this.tint(this.taskPlates[row], CONTROL_COLOR)
      return
    }
    const actualIndex = this.scrollOffset + row
    const selected = actualIndex === this.selectedTask ? "● " : ""
    const minutes = Math.floor(task.remainingSeconds / 60)
    const seconds = Math.floor(task.remainingSeconds % 60)
    const clock = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
    const status = task.status === "done" ? " ✓" : task.status === "skipped" ? " ↷" : ""
    this.taskLabels[row].text = `${selected}${this.short(task.title)}\n${clock}${status}`
    this.priorityLabels[row].text = `P${task.priority}`
    this.playLabels[row].text = task.status === "running" ? "Ⅱ" : "▶"
    this.tint(this.taskPlates[row], task.status === "running" ? RUNNING_ROW_COLOR : actualIndex === this.selectedTask ? SELECTED_ROW_COLOR : CONTROL_COLOR)
  }

  setCarouselDrag(progress: number): void {
    this.dragShift = Math.max(-1.2, Math.min(1.2, progress))
    this.updateCarouselTargets()
  }

  private updateCarouselTargets(): void {
    const count = this.cardRoots.length
    // El arrastre corre todo el carrusel de forma continua; al soltar, el snap
    // cambia selectedCard y las cards ya están casi en su lugar (sin salto).
    const shiftX = this.dragShift * 34
    const centerBlend = Math.min(1, Math.abs(this.dragShift))
    for (let index = 0; index < count; index++) {
      let diff = (index - this.selectedCard + count) % count
      if (diff > count / 2) diff -= count
      const abs = Math.abs(diff)
      this.cardRoots[index].enabled = abs <= 2
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
    text.text = value; text.size = size; text.depthTest = true
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
  private short(value: string): string { return value.length > 22 ? value.substring(0, 20) + "…" : value }
  private visibleIndex(row: number): number { return this.scrollOffset + row }
  // Las tareas se ven desde el carrusel: lista tipo checklist en las cards vecinas.
  private previewTasks(card: FocusCardState): string {
    if (card.tasks.length === 0) return "+ Agregar primera tarea"
    const lines = card.tasks.slice(0, 6).map((task) => {
      const mark = task.status === "done" ? "✓" : task.status === "running" ? "▶" : task.status === "skipped" ? "↷" : "○"
      return `${mark}  ${this.short(task.title)}`
    })
    if (card.tasks.length > 6) lines.push(`+ ${card.tasks.length - 6} más`)
    return lines.join("\n")
  }
  private obj(parent: SceneObject, name: string, position: vec3): SceneObject {
    const object = global.scene.createSceneObject(name); object.setParent(parent); object.getTransform().setLocalPosition(position); return object
  }
}
