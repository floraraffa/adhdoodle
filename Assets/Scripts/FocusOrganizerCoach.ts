import {OpenAI} from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI"
import {Gemini} from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"
import {FocusTaskState, stripStepTimes} from "./FocusOrganizerState"
import {STR} from "./Strings"

export interface TaskEstimate {
  minutes: number
  steps: string[]
  message: string
}

export class FocusOrganizerCoach {
  constructor(private host: BaseScriptComponent | null = null) {}

  async estimateTask(category: string, task: FocusTaskState): Promise<TaskEstimate> {
    const note = task.note.trim().length > 0 ? task.note.trim() : STR.noNotes
    const prompt = STR.promptEstimate(task.title, note, category)
    // Sin token de RSG la request puede colgarse en vez de rechazar → carrera con timeout.
    const remote = this.askOpenAI(prompt).catch(() => null)
    const winner = await Promise.race([remote, this.delay(8).then(() => null)])
    if (winner) return winner
    print("[FocusCoach] estimación remota no disponible → heurística local")
    return this.localEstimate(task)
  }

  private async askOpenAI(prompt: string): Promise<TaskEstimate> {
    const response = await OpenAI.chatCompletions({model: "gpt-4.1-nano", messages: [
      {role: "system", content: STR.coachSystemJson},
      {role: "user", content: prompt},
    ], temperature: 0.4})
    return this.parseEstimate(response.choices[0].message.content || "")
  }

  private delay(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.host) { resolve(); return }
      const event = this.host.createEvent("DelayedCallbackEvent")
      event.bind(() => resolve())
      event.reset(seconds)
    })
  }

  private parseEstimate(raw: string): TaskEstimate {
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim()
    const parsed = JSON.parse(clean) as {minutes?: unknown; steps?: unknown; message?: unknown}
    const minutes = typeof parsed.minutes === "number" && isFinite(parsed.minutes) ? Math.max(5, Math.min(90, Math.round(parsed.minutes))) : 15
    // Un solo tiempo total: si el modelo igual mete minutos en los pasos, se limpian.
    const steps = (Array.isArray(parsed.steps) ? parsed.steps.filter((step) => typeof step === "string").slice(0, 4) : [])
      .map((step) => stripStepTimes(step))
      .filter((step) => step.length > 0)
    const message = typeof parsed.message === "string" && parsed.message.length > 0 ? parsed.message : STR.estimateReady
    if (steps.length === 0) throw new Error("estimate sin pasos")
    return {minutes, steps, message}
  }

  // Sin red: heurística local para que el flujo nunca se rompa.
  private localEstimate(task: FocusTaskState): TaskEstimate {
    const lines = task.note.split("\n").map((line) => line.trim()).filter((line) => line.length > 2)
    const minutes = Math.max(10, Math.min(60, 10 + lines.length * 10))
    const steps = lines.length > 0 ? lines.slice(0, 4) : STR.localSteps.slice()
    return {minutes, steps, message: STR.localEstimateMsg}
  }

  celebrate(category: string, task: FocusTaskState): Promise<string> {
    return this.ask(STR.promptCelebrate(task.title, category))
  }
  guideDelay(category: string, task: FocusTaskState): Promise<string> {
    return this.ask(STR.promptDelay(task.title, category))
  }
  guideSkip(category: string, task: FocusTaskState): Promise<string> {
    return this.ask(STR.promptSkip(task.title, category))
  }
  private async ask(prompt: string): Promise<string> {
    try {
      const response = await OpenAI.chatCompletions({model: "gpt-4.1-nano", messages: [
        {role: "system", content: STR.coachSystem},
        {role: "user", content: prompt},
      ], temperature: 0.65})
      return response.choices[0].message.content || STR.coachFallback
    } catch (_) {
      try {
        const response = await Gemini.models({model: "gemini-2.0-flash", type: "generateContent", body: {contents: [{role: "user", parts: [{text: STR.geminiPrefix + prompt}]}]}})
        return response.candidates[0].content.parts[0].text || STR.coachFallback
      } catch (_) { return STR.coachFallback }
    }
  }
}
