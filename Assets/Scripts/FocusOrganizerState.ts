export type TaskStatus = "idle" | "running" | "paused" | "done" | "skipped"

export interface FocusTaskState {
  title: string
  durationMinutes: number
  remainingSeconds: number
  priority: number
  status: TaskStatus
  focusElapsedSeconds: number
}

export interface FocusCardState {
  category: string
  tasks: FocusTaskState[]
}

export class FocusOrganizerState {
  private readonly cards: FocusCardState[]
  private selectedCardIndex = 0
  private selectedTaskIndex = 0

  constructor() {
    this.cards = [
      this.card("Trabajo", [
        "Elegir el primer paso",
        "Revisar mensajes importantes",
        "Preparar el borrador",
        "Enviar una actualización",
        "Agendar el seguimiento",
        "Cerrar pestañas que distraen",
      ]),
      this.card("Casa", ["Ordenar una superficie", "Poner una lavadora"]),
      this.card("Relax", ["Descansar sin pantalla"]),
      this.card("Comida + bienestar", ["Tomar agua", "Preparar algo nutritivo"]),
      this.card("Amigos", ["Escribir a alguien"]),
      this.card("Hiperfoco", ["Definir un límite amable", "Pausa para estirar"]),
    ]
  }

  get allCards(): readonly FocusCardState[] { return this.cards }
  get activeCardIndex(): number { return this.selectedCardIndex }
  get activeTaskIndex(): number { return this.selectedTaskIndex }
  get activeCard(): FocusCardState { return this.cards[this.selectedCardIndex] }
  get activeTask(): FocusTaskState | null { return this.activeCard.tasks[this.selectedTaskIndex] ?? null }

  moveCard(direction: number): void {
    this.selectedCardIndex = (this.selectedCardIndex + direction + this.cards.length) % this.cards.length
    this.selectedTaskIndex = 0
  }

  selectCard(index: number): void {
    if (index >= 0 && index < this.cards.length) {
      this.selectedCardIndex = index
      this.selectedTaskIndex = 0
    }
  }

  selectTask(index: number): void {
    if (index >= 0 && index < this.activeCard.tasks.length) this.selectedTaskIndex = index
  }

  upsertTask(index: number, text: string): void {
    const clean = text.trim()
    if (!clean) return
    this.selectedTaskIndex = index
    if (index < this.activeCard.tasks.length) {
      this.activeCard.tasks[index].title = clean
      return
    }
    while (this.activeCard.tasks.length < index) this.activeCard.tasks.push(this.task("Nueva tarea"))
    this.activeCard.tasks.push(this.task(clean))
    this.refreshPriorities(this.activeCard.tasks)
  }

  moveTask(index: number, direction: number): void {
    const tasks = this.activeCard.tasks
    const target = index + direction
    if (index < 0 || index >= tasks.length || target < 0 || target >= tasks.length) return
    const moving = tasks[index]
    tasks[index] = tasks[target]
    tasks[target] = moving
    this.selectedTaskIndex = target
    this.refreshPriorities(tasks)
  }

  adjustMinutes(delta: number): void {
    const task = this.activeTask
    if (!task) return
    task.durationMinutes = Math.max(5, Math.min(90, task.durationMinutes + delta))
    if (task.status !== "running") task.remainingSeconds = task.durationMinutes * 60
  }

  toggleTask(index: number): boolean {
    const task = this.activeCard.tasks[index]
    if (!task) return false
    this.selectedTaskIndex = index
    if (task.status === "running") {
      task.status = "paused"
      return false
    }
    this.pauseEveryTask()
    task.status = "running"
    if (task.remainingSeconds <= 0) task.remainingSeconds = task.durationMinutes * 60
    return true
  }

  skipTask(index: number): FocusTaskState | null {
    const task = this.activeCard.tasks[index]
    if (!task) return null
    task.status = "skipped"
    task.remainingSeconds = task.durationMinutes * 60
    this.selectedTaskIndex = Math.min(index + 1, Math.max(0, this.activeCard.tasks.length - 1))
    return task
  }

  completeTask(index: number): FocusTaskState | null {
    const task = this.activeCard.tasks[index]
    if (!task) return null
    task.status = "done"
    task.remainingSeconds = task.durationMinutes * 60
    this.selectedTaskIndex = index
    return task
  }

  update(deltaSeconds: number): {cardIndex: number; taskIndex: number} | null {
    for (let cardIndex = 0; cardIndex < this.cards.length; cardIndex++) {
      for (let taskIndex = 0; taskIndex < this.cards[cardIndex].tasks.length; taskIndex++) {
        const task = this.cards[cardIndex].tasks[taskIndex]
        if (task.status !== "running") continue
        task.remainingSeconds = Math.max(0, task.remainingSeconds - deltaSeconds)
        task.focusElapsedSeconds += deltaSeconds
        if (task.remainingSeconds === 0) {
          task.status = "paused"
          return {cardIndex, taskIndex}
        }
      }
    }
    return null
  }

  private pauseEveryTask(): void {
    for (const card of this.cards) {
      for (const task of card.tasks) if (task.status === "running") task.status = "paused"
    }
  }

  get runningContext(): {cardIndex: number; taskIndex: number; task: FocusTaskState} | null {
    for (let cardIndex = 0; cardIndex < this.cards.length; cardIndex++) {
      const taskIndex = this.cards[cardIndex].tasks.findIndex((task) => task.status === "running")
      if (taskIndex >= 0) return {cardIndex, taskIndex, task: this.cards[cardIndex].tasks[taskIndex]}
    }
    return null
  }

  private card(category: string, taskTitles: string[]): FocusCardState {
    return {category, tasks: taskTitles.map((title, index) => this.task(title, index + 1))}
  }

  private task(title: string, priority: number = 1): FocusTaskState {
    return {title, durationMinutes: 15, remainingSeconds: 900, priority, status: "idle", focusElapsedSeconds: 0}
  }

  private refreshPriorities(tasks: FocusTaskState[]): void {
    for (let index = 0; index < tasks.length; index++) tasks[index].priority = index + 1
  }
}
