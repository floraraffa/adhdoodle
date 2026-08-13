export type Lang = "en" | "es"

// null = detectar el idioma del sistema del dispositivo (multilenguaje automático).
// Para forzar un idioma en un demo: "en" o "es".
const FORCE_LANG: Lang | null = null

function detectLang(): Lang {
  if (FORCE_LANG) return FORCE_LANG
  try {
    const system = (global.deviceInfoSystem as unknown as {getSystemLanguage?: () => string}).getSystemLanguage?.() ?? ""
    if (system.toLowerCase().startsWith("es")) return "es"
  } catch (_) { /* sin info de idioma → inglés */ }
  return "en"
}

export const LANG: Lang = detectLang()

const EN = {
  categories: ["Home", "Work", "Me time"],
  demoTasks: [
    ["Clear one surface", "Start the laundry", "Make something nourishing"],
    ["Finish presentation", "Check important messages", "Prepare the draft", "Send an update"],
    ["Rest without screens", "Text someone", "Stretch break"],
  ],
  newTaskDefault: "New task",
  taskCount: (total: number, done: number) => `${total} tasks · ${done} done`,
  addTask: "+ Add task",
  addFirstTask: "+ Add your first task",
  more: (count: number) => `+ ${count} more`,
  skip: "Skip",
  newTaskButton: "+ task",
  priorityUp: "↑ priority",
  priorityDown: "↓ priority",
  minus5: "−5m",
  plus5: "+5m",
  bellOn: (minutes: number) => `🔔 ${minutes}m`,
  bellOff: "🔕 off",
  listUp: "↑ list",
  listDown: "↓ list",
  indexHint: "index finger ↔ cards",
  coachStart: "Pick a task and press ▶",
  coachCard: "Pick a task from this card",
  coachRunning: "One task. One block. You can pause.",
  coachPaused: "Pause without guilt.",
  coachSkipped: "Skipped. Pick the next one, no guilt.",
  coachDone: "Done. It counts.",
  notePlaceholder: "Tap here and jot down\nyour steps…",
  estimateButton: "✨ estimate",
  estimateThinking: "Thinking of a kind estimate…",
  reminderSet: (minutes: number) => `I'll check in every ${minutes} minutes.`,
  reminderOff: "Sound check-in off.",
  checkQuestion: (title: string) => `Still on ${title}?`,
  checkFocused: "Still on it ✓",
  checkDrifted: "I drifted ↩",
  checkKeepGoing: "Still here. Good block.",
  comeBackStep: (step: string) => `No guilt. Come back with something small: ${step}`,
  comeBackGeneric: "No guilt. Come back with the smallest step you can.",
  comeBackIdle: "No guilt. Pick something small to start.",
  coachSystem: "You are a kind ADHD coach. English, max 18 words, concrete, no guilt, no medical claims.",
  coachSystemJson: "You are a kind ADHD coach. English, concrete, no guilt, no medical claims. You reply with valid JSON only.",
  promptCelebrate: (title: string, category: string) => `They completed "${title}" in ${category}. Celebrate the progress and suggest a short break.`,
  promptDelay: (title: string, category: string) => `Time ran out for "${title}" in ${category}. No guilt — suggest a step that takes under five minutes.`,
  promptSkip: (title: string, category: string) => `They chose to skip "${title}" in ${category}. Validate the decision and suggest picking the next priority.`,
  promptEstimate: (title: string, note: string, category: string) =>
    `Task: "${title}" (area: ${category}). The person's notes: "${note}". ` +
    `Estimate how many minutes it will really take someone with ADHD (add a kind buffer, no rushing) ` +
    `and split it into 2 to 4 concrete micro-steps; the first must be tiny, to beat task initiation. ` +
    `IMPORTANT: one single total time in "minutes"; steps carry no minutes or time numbers. ` +
    `Reply ONLY with valid JSON, no extra text: {"minutes": number, "steps": ["step", "..."], "message": "short encouragement"}`,
  geminiPrefix: "Reply in English, kind, max 18 words. ",
  coachFallback: "Good step. Pick what's next without rushing.",
  noNotes: "no notes",
  estimateReady: "Estimate ready. Adjust it if it doesn't fit.",
  localSteps: ["Prepare only what you need", "Do the first small part", "Close with a quick review"],
  localEstimateMsg: "Local estimate (offline). Adjust with − and +.",
  focusOn: "Focus on. Everything else can wait.",
  focusRemaining: (clock: string) => `${clock} remaining`,
  focusPause: "Ⅱ pause",
  focusDone: "✓ done",
  focusNudges: ["Hey! Focus — you're almost done!", "Let's finish this first!", "Back to it. Small step, big win."],
  badges: ["🔥", "⭐", "🍃"],
}

const ES: typeof EN = {
  categories: ["Casa", "Trabajo", "Mi tiempo"],
  demoTasks: [
    ["Ordenar una superficie", "Poner una lavadora", "Preparar algo nutritivo"],
    ["Terminar la presentación", "Revisar mensajes importantes", "Preparar el borrador", "Enviar una actualización"],
    ["Descansar sin pantalla", "Escribir a alguien", "Pausa para estirar"],
  ],
  newTaskDefault: "Nueva tarea",
  taskCount: (total: number, done: number) => `${total} tareas · ${done} hechas`,
  addTask: "+ Agregar tarea",
  addFirstTask: "+ Agregar primera tarea",
  more: (count: number) => `+ ${count} más`,
  skip: "Pasar",
  newTaskButton: "+ tarea",
  priorityUp: "↑ prioridad",
  priorityDown: "↓ prioridad",
  minus5: "−5m",
  plus5: "+5m",
  bellOn: (minutes: number) => `🔔 ${minutes}m`,
  bellOff: "🔕 off",
  listUp: "↑ lista",
  listDown: "↓ lista",
  indexHint: "índice ↔ cards",
  coachStart: "Elegí una tarea y presioná ▶",
  coachCard: "Elegí una tarea de esta card",
  coachRunning: "Una tarea. Un bloque. Podés pausar.",
  coachPaused: "Pausa sin culpa.",
  coachSkipped: "Pasada. Elegí la siguiente sin culpa.",
  coachDone: "Hecho. Ya cuenta.",
  notePlaceholder: "Tocá acá y anotá\ntus pasos…",
  estimateButton: "✨ estimar",
  estimateThinking: "Pensando una estimación amable…",
  reminderSet: (minutes: number) => `Te preguntaré cada ${minutes} minutos.`,
  reminderOff: "Recordatorio sonoro desactivado.",
  checkQuestion: (title: string) => `¿Seguís con ${title}?`,
  checkFocused: "Sigo ✓",
  checkDrifted: "Me distraje ↩",
  checkKeepGoing: "Seguís ahí. Buen bloque.",
  comeBackStep: (step: string) => `Sin culpa. Volvé con algo chico: ${step}`,
  comeBackGeneric: "Sin culpa. Volvé con el paso más chico que puedas.",
  comeBackIdle: "Sin culpa. Elegí algo chico para arrancar.",
  coachSystem: "Sos un coach TDAH amable. Español, máximo 18 palabras, concreto, sin culpa ni afirmaciones médicas.",
  coachSystemJson: "Sos un coach TDAH amable. Español, concreto, sin culpa ni afirmaciones médicas. Respondés solo JSON válido.",
  promptCelebrate: (title: string, category: string) => `Completó "${title}" en ${category}. Celebrá el avance y sugerí una pausa breve.`,
  promptDelay: (title: string, category: string) => `Terminó el tiempo para "${title}" en ${category}. Sin culpa, proponé un paso de menos de cinco minutos.`,
  promptSkip: (title: string, category: string) => `Decidió pasar "${title}" en ${category}. Validá la decisión y sugerí elegir la siguiente prioridad.`,
  promptEstimate: (title: string, note: string, category: string) =>
    `Tarea: "${title}" (área: ${category}). Notas de la persona: "${note}". ` +
    `Estimá cuántos minutos reales le llevará a una persona con TDAH (sumá un margen amable, sin apurar) ` +
    `y dividila en 2 a 4 micro-pasos concretos; el primero debe ser muy chico, para vencer el arranque. ` +
    `IMPORTANTE: un solo tiempo total en "minutes"; los pasos NO llevan minutos ni números de tiempo. ` +
    `Respondé SOLO un JSON válido, sin texto extra: {"minutes": numero, "steps": ["paso", "..."], "message": "aliento corto"}`,
  geminiPrefix: "Respondé en español, amable y en máximo 18 palabras. ",
  coachFallback: "Buen paso. Elegí lo siguiente sin apurarte.",
  noNotes: "sin notas",
  estimateReady: "Estimación lista. Ajustala si no te cierra.",
  localSteps: ["Prepará solo lo necesario", "Hacé la primera parte pequeña", "Cerrá con una revisión corta"],
  localEstimateMsg: "Estimación local (sin conexión). Ajustala con − y +.",
  focusOn: "Foco activado. El resto puede esperar.",
  focusRemaining: (clock: string) => `quedan ${clock}`,
  focusPause: "Ⅱ pausa",
  focusDone: "✓ listo",
  focusNudges: ["¡Hey! Foco — ¡ya casi terminás!", "¡Terminemos esto primero!", "Volvé. Paso chico, victoria grande."],
  badges: ["🔥", "⭐", "🍃"],
}

export const STR = LANG === "es" ? ES : EN
