import {FocusCarouselSwipe} from "./FocusCarouselSwipe"
import {FocusSentinel} from "./FocusSentinel"
import {FocusOrganizerCoach} from "./FocusOrganizerCoach"
import {FocusOrganizerPanelUI} from "./FocusOrganizerPanelUI"
import {FocusOrganizerState, FocusTaskState, SavedOrganizerState} from "./FocusOrganizerState"
import {loadJSON, saveJSON} from "./FocusPersist"
import {STR} from "./Strings"

const KEY_STATE = "focus_organizer_v1"
const RUNNING_SAVE_INTERVAL = 10

interface SavedPayload {
  reminderMinutes: number
  organizer: SavedOrganizerState
}

const FOCUS_TAP = requireAsset("../GeneratedSFX/FocusTap.wav") as AudioTrackAsset
const TASK_DONE = requireAsset("../GeneratedSFX/TaskDone.wav") as AudioTrackAsset
const FOCUS_REMINDER = requireAsset("../GeneratedSFX/FocusReminder.wav") as AudioTrackAsset

@component
export class FocusOrganizerMain extends BaseScriptComponent {
  @input panel!: FocusOrganizerPanelUI
  @input sfxVolume: number = 0.65
  @input reminderMinutes: number = 5
  private state = new FocusOrganizerState()
  private coach = new FocusOrganizerCoach(this)
  private swipe!: FocusCarouselSwipe
  private tapAudio: AudioComponent | null = null
  private doneAudio: AudioComponent | null = null
  private reminderAudio: AudioComponent | null = null
  private lastSecond = -1
  private reminderKey = ""
  private reminderBucket = 0
  private sinceLastSave = 0
  private focusMode = false
  private sentinel = new FocusSentinel(() => this.onDistractionCandidate())
  private nudgeIndex = 0

  onAwake(): void {
    this.swipe = this.sceneObject.createComponent(FocusCarouselSwipe.getTypeName()) as FocusCarouselSwipe
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart(): void {
    if (!this.panel) { console.error("[FocusOrganizerMain] panel no conectado"); return }
    const saved = loadJSON<SavedPayload>(KEY_STATE)
    if (saved) {
      if (this.state.restore(saved.organizer)) print("[FocusOrganizer] estado restaurado de la sesión anterior")
      if (saved.reminderMinutes === 0 || saved.reminderMinutes === 5 || saved.reminderMinutes === 10) this.reminderMinutes = saved.reminderMinutes
    }
    this.swipe.setIndexDragTarget(this.panel.sceneObject)
    this.tapAudio = this.createSfx("FocusTapAudio", FOCUS_TAP); this.doneAudio = this.createSfx("TaskDoneAudio", TASK_DONE)
    this.reminderAudio = this.createSfx("FocusReminderAudio", FOCUS_REMINDER)
    this.swipe.onSwipe.add((direction) => { this.state.moveCard(direction); this.play(this.tapAudio); this.panel.setCoach(STR.coachCard); this.render() })
    this.swipe.onScroll.add((direction) => { this.panel.scrollTasks(direction); this.play(this.tapAudio) })
    this.swipe.onDragProgress.add((progress) => this.panel.setCarouselDrag(progress))
    this.panel.onNoteEdited.add(({taskIndex, text}) => { this.state.setNote(taskIndex, text); this.render(); this.saveState() })
    this.panel.onEstimateRequested.add((taskIndex) => this.estimateWithAI(taskIndex))
    this.panel.onCheckIn.add((drifted) => this.handleCheckIn(drifted))
    this.panel.onCardSelected.add((index) => { this.state.selectCard(index); this.play(this.tapAudio); this.panel.setCoach(STR.coachCard); this.render() })
    this.panel.onFocusPause.add(() => this.pauseFromFocus())
    this.panel.onFocusDone.add(() => { const running = this.state.runningContext; if (running) { this.state.selectCard(running.cardIndex); this.complete(running.taskIndex) } })
    this.panel.onTaskEdited.add(({taskIndex, text}) => { this.state.selectTask(taskIndex); this.state.upsertTask(taskIndex, text); this.render(); this.saveState() })
    this.panel.onMovePriority.add(({taskIndex, direction}) => { this.state.moveTask(taskIndex, direction); this.play(this.tapAudio); this.render(); this.saveState() })
    this.panel.onReminderCycle.add(() => this.cycleReminder())
    this.panel.onTimeDelta.add(({taskIndex, delta}) => { this.state.selectTask(taskIndex); this.state.adjustMinutes(delta); this.render(); this.saveState() })
    this.panel.onPlay.add((index) => { const running = this.state.toggleTask(index); this.syncReminderTracking(); this.panel.hideCheckIn(); this.play(this.tapAudio); this.panel.setCoach(running ? STR.coachRunning : STR.coachPaused); if (running) this.enterFocus(); else this.exitFocus(); this.render(); this.saveState() })
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
    if (!this.focusMode) this.checkReminder(running)
    if (running && this.reminderMinutes > 0) {
      const interval = this.reminderMinutes * 60
      this.panel.setReminderProgress(1 - (running.task.focusElapsedSeconds % interval) / interval)
    } else {
      this.panel.setReminderProgress(null)
    }
    this.sentinel.update(getDeltaTime())
    if (this.focusMode && running) this.panel.renderFocus(running.task.title, running.task.remainingSeconds)
    if (this.focusMode && !running) this.exitFocus()
    this.panel.updateFocusChip(running ? {
      title: running.task.title,
      remainingSeconds: running.task.remainingSeconds,
      step: running.task.aiSteps[0] ?? null,
    } : null)
    if (running) {
      this.sinceLastSave += getDeltaTime()
      if (this.sinceLastSave >= RUNNING_SAVE_INTERVAL) this.saveState()
    }
    if (delayed) {
      this.state.selectCard(delayed.cardIndex); this.state.selectTask(delayed.taskIndex); this.render(); this.saveState()
      const task = this.state.activeTask
      if (task) this.coach.guideDelay(this.state.activeCard.category, task).then((message) => this.panel.setCoach(message))
    }
  }

  private skip(index: number): void {
    const category = this.state.activeCard.category
    const task = this.state.skipTask(index)
    this.panel.hideCheckIn()
    this.exitFocus()
    this.play(this.tapAudio); this.render(); this.saveState(); this.panel.setCoach(STR.coachSkipped)
    if (task) this.coach.guideSkip(category, task).then((message) => this.panel.setCoach(message))
  }

  private complete(index: number): void {
    const category = this.state.activeCard.category
    const task = this.state.completeTask(index)
    this.panel.hideCheckIn()
    this.exitFocus()
    this.play(this.doneAudio); this.render(); this.saveState(); this.panel.setCoach(STR.coachDone)
    if (task) this.coach.celebrate(category, task).then((message) => this.panel.setCoach(message))
  }

  private estimateWithAI(taskIndex: number): void {
    const task = this.state.activeCard.tasks[taskIndex]
    if (!task) return
    print(`[FocusCoach] estimando "${task.title}"…`)
    this.panel.setCoach(STR.estimateThinking)
    this.coach.estimateTask(this.state.activeCard.category, task).then((estimate) => {
      this.state.selectTask(taskIndex)
      this.state.applyEstimate(taskIndex, estimate.minutes, estimate.steps)
      this.panel.setCoach(estimate.message)
      this.render()
      this.saveState()
      print(`[FocusCoach] estimación: ${estimate.minutes} min, ${estimate.steps.length} pasos`)
    })
  }

  private cycleReminder(): void {
    this.reminderMinutes = this.reminderMinutes === 5 ? 10 : this.reminderMinutes === 10 ? 0 : 5
    this.panel.setReminderLabel(this.reminderMinutes)
    this.syncReminderTracking()
    this.saveState()
    this.play(this.reminderAudio)
    this.panel.setCoach(this.reminderMinutes > 0 ? STR.reminderSet(this.reminderMinutes) : STR.reminderOff)
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
    this.panel.setCoach(STR.checkQuestion(running.task.title))
    this.panel.showCheckIn()
    print(`[FocusReminder] check-in a los ${elapsed} min de "${running.task.title}"`)
  }

  private saveState(): void {
    this.sinceLastSave = 0
    saveJSON(KEY_STATE, {reminderMinutes: this.reminderMinutes, organizer: this.state.serialize()} as SavedPayload)
  }

  private render(): void {
    const running = this.state.runningContext
    this.lastSecond = Math.ceil(running?.task.remainingSeconds ?? this.state.activeTask?.remainingSeconds ?? 0)
    this.panel.render(this.state.allCards, this.state.activeCardIndex, this.state.activeTaskIndex)
    // Túnel solo si la tarea corriendo está en la card que se mira.
    this.panel.setTunnel(running && running.cardIndex === this.state.activeCardIndex ? running.taskIndex : null)
  }

  private enterFocus(): void {
    if (this.focusMode) return
    this.focusMode = true
    this.panel.setFocusMode(true)
    this.sentinel.start()
    this.panel.setCoach(STR.focusOn)
    print("[FocusMode] activado")
  }

  private exitFocus(): void {
    if (!this.focusMode) return
    this.focusMode = false
    this.panel.setFocusMode(false)
    this.sentinel.stop()
    this.render()
    print("[FocusMode] desactivado")
  }

  private pauseFromFocus(): void {
    const running = this.state.runningContext
    if (running) {
      this.state.selectCard(running.cardIndex)
      this.state.toggleTask(running.taskIndex)
    }
    this.exitFocus()
    this.panel.setCoach(STR.coachPaused)
    this.render()
    this.saveState()
  }

  // Candidato de la heurística de pose → verificación con UN frame de visión IA.
  private onDistractionCandidate(): void {
    const running = this.state.runningContext
    if (!running || !this.focusMode) return
    this.coach.verifyFocusVision(running.task.title).then((verdict) => {
      print(`[FocusSentinel] visión: ${verdict}`)
      if (verdict === "related") { this.sentinel.markStillFocused(); return }
      const message = STR.focusNudges[this.nudgeIndex % STR.focusNudges.length]
      this.nudgeIndex++
      this.panel.showFocusNudge(message)
      this.play(this.reminderAudio)
      const hide = this.createEvent("DelayedCallbackEvent")
      hide.bind(() => this.panel.clearFocusNudge())
      hide.reset(7)
    })
  }

  private handleCheckIn(drifted: boolean): void {
    const running = this.state.runningContext
    if (!drifted) {
      this.panel.setCoach(STR.checkKeepGoing)
      return
    }
    if (running) {
      const drifts = this.state.registerDrift(running.cardIndex, running.taskIndex)
      const step = running.task.aiSteps[0]
      this.panel.setCoach(step ? STR.comeBackStep(step) : STR.comeBackGeneric)
      this.saveState()
      print(`[FocusCheckIn] deriva registrada (${drifts}) en "${running.task.title}"`)
    } else {
      this.panel.setCoach(STR.comeBackIdle)
    }
  }

  private createSfx(name: string, track: AudioTrackAsset): AudioComponent {
    const object = global.scene.createSceneObject(name); object.setParent(this.sceneObject)
    const audio = object.createComponent("Component.AudioComponent") as AudioComponent
    audio.audioTrack = track; audio.volume = this.sfxVolume; audio.playbackMode = Audio.PlaybackMode.LowLatency; return audio
  }
  private play(audio: AudioComponent | null): void { if (audio) audio.play(1) }
}
