import {OpenAI} from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI"
import {Gemini} from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"
import {FocusTaskState} from "./FocusOrganizerState"

export class FocusOrganizerCoach {
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
