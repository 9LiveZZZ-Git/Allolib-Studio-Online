/**
 * Parser and serializer for AlloLib .synthSequence files.
 *
 * Format variants:
 *   @ startTime duration SynthName param1 param2 ...   (timed event)
 *   + startTime eventId SynthName params...             (trigger on)
 *   - startTime eventId                                 (trigger off)
 *   t bpm                                               (tempo)
 *   # comment                                           (comment / param docs)
 */

// ── Types ───────────────────────────────────────────────────────────

export interface SynthSequenceEvent {
  type: '@' | '+' | '-'
  startTime: number
  duration: number        // only meaningful for '@' events
  synthName: string
  params: number[]        // raw parameter values
  eventId?: number        // for +/- trigger pairs
}

export interface SynthSequenceData {
  events: SynthSequenceEvent[]
  tempo: number           // BPM (default 120 if not specified)
  paramNames: string[]    // extracted from trailing # comments
  comments: string[]      // raw comment lines preserved for round-trip
}

// ── Parser ──────────────────────────────────────────────────────────

export function parseSynthSequence(text: string): SynthSequenceData {
  const lines = text.split('\n')
  const events: SynthSequenceEvent[] = []
  const comments: string[] = []
  let tempo = 120
  let paramNames: string[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (line === '') continue

    if (line.startsWith('#')) {
      comments.push(line)
      // Try to extract param names from comment lines like:
      // # SineEnv amplitude frequency attackTime releaseTime pan
      // #  amplitude frequency attackTime releaseTime pan
      const stripped = line.replace(/^#\s*/, '')
      const tokens = stripped.split(/\s+/).filter(Boolean)
      if (tokens.length >= 2) {
        // Heuristic: if first token looks like a synth name (starts uppercase),
        // the rest are param names.  Otherwise all tokens are param names.
        const first = tokens[0]
        if (/^[A-Z]/.test(first) && tokens.length >= 3) {
          paramNames = tokens.slice(1)
        } else if (paramNames.length === 0 && tokens.every(t => /^[a-zA-Z]/.test(t))) {
          paramNames = tokens
        }
      }
      continue
    }

    if (line.startsWith('t ')) {
      const bpmStr = line.substring(2).trim()
      const parsed = parseFloat(bpmStr)
      if (!isNaN(parsed) && parsed > 0) tempo = parsed
      continue
    }

    if (line.startsWith('@ ')) {
      const tokens = line.substring(2).trim().split(/\s+/)
      if (tokens.length >= 3) {
        const startTime = parseFloat(tokens[0])
        const duration = parseFloat(tokens[1])
        const synthName = tokens[2]
        const params = tokens.slice(3).map(Number)
        if (!isNaN(startTime) && !isNaN(duration)) {
          events.push({ type: '@', startTime, duration, synthName, params })
        }
      }
      continue
    }

    if (line.startsWith('+ ')) {
      const tokens = line.substring(2).trim().split(/\s+/)
      if (tokens.length >= 3) {
        const startTime = parseFloat(tokens[0])
        const eventId = parseInt(tokens[1], 10)
        const synthName = tokens[2]
        const params = tokens.slice(3).map(Number)
        if (!isNaN(startTime) && !isNaN(eventId)) {
          events.push({ type: '+', startTime, duration: 0, synthName, params, eventId })
        }
      }
      continue
    }

    if (line.startsWith('- ')) {
      const tokens = line.substring(2).trim().split(/\s+/)
      if (tokens.length >= 2) {
        const startTime = parseFloat(tokens[0])
        const eventId = parseInt(tokens[1], 10)
        if (!isNaN(startTime) && !isNaN(eventId)) {
          events.push({ type: '-', startTime, duration: 0, synthName: '', params: [], eventId })
        }
      }
      continue
    }
  }

  return { events, tempo, paramNames, comments }
}

// ── Serializer ──────────────────────────────────────────────────────

export function serializeSynthSequence(data: SynthSequenceData): string {
  const lines: string[] = []

  // Write param name comment header if available
  if (data.paramNames.length > 0) {
    // Find a representative synth name from events
    const synthName = data.events.find(e => e.type === '@' || e.type === '+')?.synthName || 'Synth'
    lines.push(`# ${synthName} ${data.paramNames.join(' ')}`)
  }

  // Write tempo if not default
  if (data.tempo !== 120) {
    lines.push(`t ${data.tempo}`)
  }

  // Sort events by start time, then serialize
  const sorted = [...data.events].sort((a, b) => a.startTime - b.startTime)

  for (const ev of sorted) {
    switch (ev.type) {
      case '@': {
        const paramStr = ev.params.map(p => formatNum(p)).join(' ')
        const base = `@ ${formatNum(ev.startTime)} ${formatNum(ev.duration)} ${ev.synthName}`
        lines.push(paramStr ? `${base} ${paramStr}` : base)
        break
      }
      case '+': {
        const paramStr = ev.params.map(p => formatNum(p)).join(' ')
        const base = `+ ${formatNum(ev.startTime)} ${ev.eventId} ${ev.synthName}`
        lines.push(paramStr ? `${base} ${paramStr}` : base)
        break
      }
      case '-': {
        lines.push(`- ${formatNum(ev.startTime)} ${ev.eventId}`)
        break
      }
    }
  }

  return lines.join('\n') + '\n'
}

function formatNum(n: number): string {
  // Avoid excessive decimal places but keep enough precision
  if (Number.isInteger(n)) return n.toString()
  // Up to 6 significant decimal digits, strip trailing zeros
  return parseFloat(n.toFixed(6)).toString()
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Resolve trigger-on / trigger-off pairs into duration-based events.
 * Useful for converting +/- pairs into @ events for the sequencer display.
 */
export function resolveTriggerPairs(data: SynthSequenceData): SynthSequenceEvent[] {
  const result: SynthSequenceEvent[] = []
  const pending = new Map<number, SynthSequenceEvent>()

  for (const ev of data.events) {
    if (ev.type === '@') {
      result.push({ ...ev })
    } else if (ev.type === '+' && ev.eventId !== undefined) {
      pending.set(ev.eventId, { ...ev })
    } else if (ev.type === '-' && ev.eventId !== undefined) {
      const start = pending.get(ev.eventId)
      if (start) {
        result.push({
          type: '@',
          startTime: start.startTime,
          duration: ev.startTime - start.startTime,
          synthName: start.synthName,
          params: start.params,
        })
        pending.delete(ev.eventId)
      }
    }
  }

  // Any remaining unclosed triggers get a default 1-second duration
  for (const ev of pending.values()) {
    result.push({
      type: '@',
      startTime: ev.startTime,
      duration: 1,
      synthName: ev.synthName,
      params: ev.params,
    })
  }

  return result.sort((a, b) => a.startTime - b.startTime)
}

/**
 * Get the total duration of a sequence (end of last event).
 */
export function getSequenceDuration(events: SynthSequenceEvent[]): number {
  let max = 0
  for (const ev of events) {
    const end = ev.startTime + ev.duration
    if (end > max) max = end
  }
  return max
}
