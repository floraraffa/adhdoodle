import {FocusCarouselSwipe} from "./FocusCarouselSwipe"
import {FocusOrganizerCoach} from "./FocusOrganizerCoach"
import {FocusOrganizerPanelUI} from "./FocusOrganizerPanelUI"
import {FocusOrganizerState, FocusTaskState} from "./FocusOrganizerState"

const FOCUS_TAP = requireAsset("../GeneratedSFX/FocusTap.wav") as AudioTrackAsset
const TASK_DONE = requireAsset("../GeneratedSFX/TaskDone.wav") as AudioTrackAsset
const FOCUS_REMINDER = requireAsset("../GeneratedSFX/FocusReminder.wav") as AudioTrackAsset

@component
export class FocusOrganizerMain extends BaseScriptComponent {
  @input panel!: FocusOrganizerPanelUI
  @input sfxVolume: number = 0.65
  @input reminderMinutes: number = 5
  private state = new FocusOrganizerState()
  private coach = new FocusOrganizerCoach()
  private swipe!: FocusCarouselSwipe
  private tapAudio: AudioComponent | null = null
  private doneAudio: AudioComponent | null = null
  private reminderAudio: AudioComponent | null = null
  private lastSecond = -1
  private reminderKey = ""
  private reminderBucket = 0

  onAwake(): void {
    this.swipe = this.sceneObject.createComponent(FocusCarouselSwipe.getTypeName()) as FocusCarouselSwipe
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart(): void {
    if (!this.panel) { console.error("[FocusOrganizerMain] panel no conectado"); return }
    this.swipe.setIndexDragTarget(this.panel.sceneObject)
    this.tapAudio = this.createSfx("FocusTapAudio", FOCUS_TAP); this.doneAudio = this.createSfx("TaskDoneAudio", TASK_DONE)
    this.reminderAudio = this.createSfx("FocusReminderAudio", FOCUS_REMINDER)
    this.swipe.onSwipe.add((direction) => { this.state.moveCard(direction); this.play(this.tapAudio); this.panel.setCoach("Elegí una tarea de esta card"); this.render() })
    this.swipe.onScroll.add((direction) => { this.panel.scrollTasks(direction); this.play(this.tapAudio) })
    this.panel.onTaskEdited.add(({taskIndex, text}) => { this.state.selectTask(taskIndex); this.state.upsertTask(taskIndex, text); this.render() })
    this.panel.onMovePriority.add(({taskIndex, direction}) => { this.state.moveTask(taskIndex, direction); this.play(this.tapAudio); this.render() })
    this.panel.onReminderCycle.add(() => this.cycleReminder())
    this.panel.onTimeDelta.add(({taskIndex, delta}) => { this.state.selectTask(taskIndex); this.state.adjustMinutes(delta); this.render() })
    this.panel.onPlay.add((index) => { const running = this.state.toggleTask(index); this.syncReminderTracking(); this.play(this.tapAudio); this.panel.setCoach(running ? "Una tarea. Un bloque. Podés pausar." : "Pausa sin culpa."); this.render() })
    this.panel.onSkip.add((index) => this.skip(index))
    this.panel.onDone.add((index) => this.complete(index))
    this.reminderMinutes = this.reminderMinutes === 10 ? 10 : this.reminderMinutes === 0 ? 0 : 5
    this.panel.setReminderLabel(this.reminderMinutes)
    this.render(); print("[FocusOrganizer] Carrusel listo: listas desplazables, prioridades y recordatorio de foco")
  }

  private onUpdate(): void {
    if (!this.panel) return
    const delayed = this.state.update(getDeltaTime())
    const running = this.state.runningContext
    const second = Math.ceil(running?.task.remainingSeconds ?? this.state.activeTask?.remainingSeconds ?? 0)
    if (second !== this.lastSecond) this.render()
    this.checkReminder(running)
    if (delayed) {
      this.state.selectCard(delayed.cardIndex); this.state.selectTask(delayed.taskIndex); this.render()
      const task = this.state.activeTask
      if (task) this.coach.guideDelay(this.state.activeCard.category, task).then((message) => this.panel.setCoach(message))
    }
  }

  private skip(index: number): void {
    const category = this.state.activeCard.category
    const task = this.state.skipTask(index)
    this.play(this.tapAudio); this.render(); this.panel.setCoach("Pasada. Elegí la siguiente sin culpa.")
    if (task) this.coach.guideSkip(category, task).then((message) => this.panel.setCoach(message))
  }

  private complete(index: number): void {
    const category = this.state.activeCard.category
    const task = this.state.completeTask(index)
    this.play(this.doneAudio); this.render(); this.panel.setCoach("Hecho. Ya cuenta.")
    if (task) this.coach.celebrate(category, task).then((message) => this.panel.setCoach(message))
  }

  private cycleReminder(): void {
    this.reminderMinutes = this.reminderMinutes === 5 ? 10 : this.reminderMinutes === 10 ? 0 : 5
    this.panel.setReminderLabel(this.reminderMinutes)
    this.syncReminderTracking()
    this.play(this.reminderAudio)
    this.panel.setCoach(this.reminderMinutes > 0 ? `Te recordaré tu tarea cada ${this.reminderMinutes} minutos.` : "Recordatorio sonoro desactivado.")
    print(`[FocusReminder] intervalo: ${this.reminderMinutes > 0 ? this.reminderMinutes + " min" : "off"}`)
  }

  private syncReminderTracking(): void {
    const running = this.state.runningContext
    if (!running) { this.reminderKey = ""; this.reminderBucket = 0; return }
    this.reminderKey = `${running.cardIndex}:${running.taskIndex}`
    const interval = Math.max(1, this.reminderMinutes) * 60
    this.reminderBucket = Math.floor(running.task.focusElapsedSeconds / interval)
  }

  private checkReminder(running: {cardIndex: number; taskIndex: number; task: FocusTaskState} | null): void {
    if (!running || this.reminderMinutes <= 0) return
    const key = `${running.cardIndex}:${running.taskIndex}`
    const interval = this.reminderMinutes * 60
    if (key !== this.reminderKey) { this.reminderKey = key; this.reminderBucket = Math.floor(running.task.focusElapsedSeconds / interval) }
    const bucket = Math.floor(running.task.focusElapsedSeconds / interval)
    if (bucket <= this.reminderBucket) return
    this.reminderBucket = bucket
    this.play(this.reminderAudio)
    const elapsed = Math.round(running.task.focusElapsedSeconds / 60)
    this.panel.setCoach(`Seguís con: ${running.task.title}. Van ${elapsed} minutos.`)
    print(`[FocusReminder] ${running.task.title} · ${elapsed} min`)
  }

  private render(): void {
    this.lastSecond = Math.ceil(this.state.runningContext?.task.remainingSeconds ?? this.state.activeTask?.remainingSeconds ?? 0)
    this.panel.render(this.state.allCards, this.state.activeCardIndex, this.state.activeTaskIndex)
  }

  private createSfx(name: string, track: AudioTrackAsset): AudioComponent {
    const object = global.scene.createSceneObject(name); object.setParent(this.sceneObject)
    const audio = object.createComponent("Component.AudioComponent") as AudioComponent
    audio.audioTrack = track; audio.volume = this.sfxVolume; audio.playbackMode = Audio.PlaybackMode.LowLatency; return audio
  }
  private play(audio: AudioComponent | null): void { if (audio) audio.play(1) }
}
