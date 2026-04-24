import { ref, onBeforeUnmount, type Ref } from 'vue'

export type ResizeAxis = 'vertical' | 'horizontal'

export interface UseResizableDragOptions {
  /** Axis to resize along. 'vertical' tracks pointer Y, 'horizontal' tracks X. */
  axis?: ResizeAxis
  /** Minimum allowed size in pixels. */
  min?: number
  /** Maximum allowed size in pixels. */
  max?: number
  /**
   * Direction multiplier. For a panel anchored to the BOTTOM resizing upward
   * (dragging up = bigger), use `invert: true`. For a panel anchored to the
   * TOP resizing downward (dragging down = bigger), use `invert: false`.
   * Default: true (preserves existing ConsolePanel behavior).
   */
  invert?: boolean
  /**
   * Function returning the element whose current size should be used as the
   * baseline when a drag starts. If omitted, `fallbackSize` is used.
   */
  getElement?: () => HTMLElement | null | undefined
  /** Used when getElement is not provided or returns null. Default: 200. */
  fallbackSize?: number
  /** Called with each new size while dragging. */
  onResize: (size: number) => void
}

/**
 * Pointer-driven resize drag — consolidates the identical copy of this logic
 * previously living in ConsolePanel.vue, AnalysisPanel.vue, and ParameterPanel.vue.
 *
 * Usage:
 *   const { startResize, isResizing } = useResizableDrag({
 *     axis: 'vertical', min: 100, max: 600,
 *     getElement: () => containerRef.value,
 *     onResize: (h) => emit('resize', h),
 *   })
 *   // template: @mousedown="startResize"
 */
export function useResizableDrag(options: UseResizableDragOptions) {
  const {
    axis = 'vertical',
    min = 0,
    max = Number.POSITIVE_INFINITY,
    invert = true,
    getElement,
    fallbackSize = 200,
    onResize,
  } = options

  const isResizing: Ref<boolean> = ref(false)
  let startCoord = 0
  let startSize = 0
  const cursor = axis === 'vertical' ? 'ns-resize' : 'ew-resize'
  const dimension = axis === 'vertical' ? 'offsetHeight' : 'offsetWidth'

  function startResize(e: MouseEvent) {
    e.preventDefault()
    isResizing.value = true
    startCoord = axis === 'vertical' ? e.clientY : e.clientX
    const el = getElement?.()
    startSize = el ? (el[dimension] as number) : fallbackSize

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', stopResize)
    document.body.style.cursor = cursor
    document.body.style.userSelect = 'none'
  }

  function onMouseMove(e: MouseEvent) {
    if (!isResizing.value) return
    const current = axis === 'vertical' ? e.clientY : e.clientX
    const rawDelta = current - startCoord
    const delta = invert ? -rawDelta : rawDelta
    const newSize = Math.max(min, Math.min(max, startSize + delta))
    onResize(newSize)
  }

  function stopResize() {
    isResizing.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', stopResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  // Safety net — if the consumer unmounts mid-drag, make sure we don't leave
  // global listeners or modified body styles behind.
  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', stopResize)
    if (isResizing.value) {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  })

  return {
    startResize,
    stopResize,
    isResizing,
  }
}
