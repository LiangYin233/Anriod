/**
 * WinUI-style Reveal Hover effect.
 * Call `useReveal()` in `onMounted` of the root layout component.
 * Uses MutationObserver to handle dynamically added elements.
 */
export function useReveal() {
  let observer: MutationObserver | null = null
  const boundElements = new Set<Element>()

  function handleMouseMove(e: MouseEvent) {
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    target.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
    target.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  }

  function bindElement(el: Element) {
    if (boundElements.has(el)) return
    el.addEventListener('mousemove', handleMouseMove as EventListener)
    boundElements.add(el)
  }

  function unbindElement(el: Element) {
    el.removeEventListener('mousemove', handleMouseMove as EventListener)
    boundElements.delete(el)
  }

  function bind() {
    // Bind existing elements
    document.querySelectorAll('.reveal-hover').forEach(bindElement)

    // Watch for dynamically added elements
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.classList?.contains('reveal-hover')) bindElement(node)
            node.querySelectorAll?.('.reveal-hover').forEach(bindElement)
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }

  function unbind() {
    observer?.disconnect()
    observer = null
    boundElements.forEach(unbindElement)
    boundElements.clear()
  }

  return { bind, unbind }
}
