import {OpenAI} from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI"
import {Gemini} from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"
import {FocusTaskState, stripStepTimes} from "./FocusOrganizerState"

export interface TaskEstimate {
  minutes: number
  steps: string[]
  message: string
}

export class FocusOrganizerCoach {
  constructor(private host: BaseScriptComponent | null = null) {}

  async estimateTask(category: string, task: FocusTaskState): Promise<TaskEstimate> {
    const note = task.note.trim().length > 0 ? task.note.trim() : "sin notas"
    const prompt =
      `Tarea: "${task.title}" (área: ${category}). Notas de la persona: "${note}". ` +
      `Estimá cuántos minutos reales le llevará a una persona con TDAH (sumá un margen amable, sin apurar) ` +
      `y dividila en 2 a 4 micro-pasos concretos; el primero debe ser muy chico, para vencer el arranque. ` +
      `IMPORTANTE: un solo tiempo total en "minutes"; los pasos NO llevan minutos ni números de tiempo. ` +
      `Respondé SOLO un JSON válido, sin texto extra: {"minutes": numero, "steps": ["paso", "..."], "message": "aliento corto"}`
    // Sin token de RSG la request puede colgarse en vez de rechazar → carrera con timeout.
    const remote = this.askOpenAI(prompt).catch(() => null)
    const winner = await Promise.race([remote, this.delay(8).then(() => null)])
    if (winner) return winner
    print("[FocusCoach] estimación remota no disponible → heurística local")
    return this.localEstimate(task)
  }

  private async askOpenAI(prompt: string): Promise<TaskEstimate> {
    const response = await OpenAI.chatCompletions({model: "gpt-4.1-nano", messages: [
      {role: "system", content: "Sos un coach TDAH amable. Español, concreto, sin culpa ni afirmaciones médicas. Respondés solo JSON válido."},
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
    const message = typeof parsed.message === "string" && parsed.message.length > 0 ? parsed.message : "Estimación lista. Ajustala si no te cierra."
    if (steps.length === 0) throw new Error("estimate sin pasos")
    return {minutes, steps, message}
  }

  // Sin red: heurística local para que el flujo nunca se rompa.
  private localEstimate(task: FocusTaskState): TaskEstimate {
    const lines = task.note.split("\n").map((line) => line.trim()).filter((line) => line.length > 2)
    const minutes = Math.max(10, Math.min(60, 10 + lines.length * 10))
    const steps = lines.length > 0
      ? lines.slice(0, 4)
      : ["Prepará solo lo necesario", "Hacé la primera parte pequeña", "Cerrá con una revisión corta"]
    return {minutes, steps, message: "Estimación local (sin conexión). Ajustala con − y +."}
  }

  celebrate(category: string, task: FocusTaskState): Promise<string> {
    return this.ask(`Completó “${task.title}” en ${category}. Celebrá el avance y sugerí una pausa breve.`)
  }
  guideDelay(category: string, task: FocusTaskState): Promise<string> {
    return this.ask(`Terminó el tiempo para “${task.title}” en ${category}. Sin culpa, proponé un paso de menos de cinco minutos.`)
  }
  guideSkip(category: string, task: FocusTaskState): Promise<string> {
    return this.ask(`Decidió pasar “${task.title}” en ${category}. Validá la decisión y sugerí elegir la siguiente prioridad.`)
  }
  private async ask(prompt: string): Promise<string> {
    try {
      const response = await OpenAI.chatCompletions({model: "gpt-4.1-nano", messages: [
        {role: "system", content: "Sos un coach TDAH amable. Español, máximo 18 palabras, concreto, sin culpa ni afirmaciones médicas."},
        {role: "user", content: prompt},
      ], temperature: 0.65})
      return response.choices[0].message.content || "Buen paso. Elegí lo siguiente sin apurarte."
    } catch (_) {
      try {
        const response = await Gemini.models({model: "gemini-2.0-flash", type: "generateContent", body: {contents: [{role: "user", parts: [{text: "Respondé en español, amable y en máximo 18 palabras. " + prompt}]}]}})
        return response.candidates[0].content.parts[0].text || "Buen paso. Elegí lo siguiente sin apurarte."
      } catch (_) { return "Buen paso. Elegí lo siguiente sin apurarte." }
    }
  }
}
