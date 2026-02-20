import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import "./ScrollArea.sass"

interface ScrollAreaProps {
  children: ReactNode
  className?: string
  maxHeight?: number
  showHorizontal?: boolean
}

export default function ScrollArea({
  children,
  className = "",
  maxHeight,
  showHorizontal = false,
}: ScrollAreaProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const thumbRef = useRef<HTMLDivElement | null>(null)
  const trackXRef = useRef<HTMLDivElement | null>(null)
  const thumbXRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    const content = contentRef.current
    const track = trackRef.current
    const thumb = thumbRef.current
    const trackX = trackXRef.current
    const thumbX = thumbXRef.current

    if (!root || !content || !track || !thumb) return

    let frame = 0

    const updateThumb = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const scrollHeight = content.scrollHeight
        const clientHeight = content.clientHeight
        const scrollTop = content.scrollTop
        const trackHeight = track.clientHeight

        const scrollable = scrollHeight - clientHeight
        const shouldHide = scrollable <= 1

        track.style.opacity = shouldHide ? "0" : "1"
        track.style.pointerEvents = shouldHide ? "none" : "auto"

        if (shouldHide) return

        const thumbHeight = Math.max(
          (clientHeight / scrollHeight) * trackHeight,
          24,
        )
        const maxThumbTop = trackHeight - thumbHeight
        const thumbTop =
          maxThumbTop > 0 ? (scrollTop / scrollable) * maxThumbTop : 0

        thumb.style.height = `${thumbHeight}px`
        thumb.style.transform = `translateY(${thumbTop}px)`

        if (showHorizontal && trackX && thumbX) {
          const scrollWidth = content.scrollWidth
          const clientWidth = content.clientWidth
          const scrollLeft = content.scrollLeft
          const trackWidth = trackX.clientWidth
          const scrollableX = scrollWidth - clientWidth
          const shouldHideX = scrollableX <= 1

          trackX.style.opacity = shouldHideX ? "0" : "1"
          trackX.style.pointerEvents = shouldHideX ? "none" : "auto"

          if (!shouldHideX) {
            const thumbWidth = Math.max(
              (clientWidth / scrollWidth) * trackWidth,
              32,
            )
            const maxThumbLeft = trackWidth - thumbWidth
            const thumbLeft =
              maxThumbLeft > 0 ? (scrollLeft / scrollableX) * maxThumbLeft : 0

            thumbX.style.width = `${thumbWidth}px`
            thumbX.style.transform = `translateX(${thumbLeft}px)`
          }
        }
      })
    }

    updateThumb()

    const handleScroll = () => updateThumb()
    content.addEventListener("scroll", handleScroll, { passive: true })

    const resizeObserver = new ResizeObserver(() => updateThumb())
    resizeObserver.observe(content)
    resizeObserver.observe(track)

    const contentChild = content.firstElementChild as HTMLElement | null
    if (contentChild) {
      resizeObserver.observe(contentChild)
    }

    const mutationObserver = new MutationObserver(() => updateThumb())
    mutationObserver.observe(content, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })

    const handleWindowResize = () => updateThumb()
    window.addEventListener("resize", handleWindowResize)

    let dragging = false
    let draggingX = false
    let startY = 0
    let startX = 0
    let startScrollTop = 0
    let startScrollLeft = 0

    const handlePointerDown = (event: PointerEvent) => {
      event.preventDefault()
      dragging = true
      root.classList.add("is-dragging-y")
      startY = event.clientY
      startScrollTop = content.scrollTop

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!dragging) return
        const trackHeight = track.clientHeight
        const thumbHeight = thumb.clientHeight
        const maxThumbTop = trackHeight - thumbHeight
        const scrollable = content.scrollHeight - content.clientHeight

        if (scrollable <= 0 || maxThumbTop <= 0) return

        const delta = moveEvent.clientY - startY
        const ratio = scrollable / maxThumbTop
        const nextScrollTop = startScrollTop + delta * ratio

        content.scrollTop = Math.max(0, Math.min(scrollable, nextScrollTop))
      }

      const handlePointerUp = () => {
        dragging = false
        root.classList.remove("is-dragging-y")
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
      }

      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
    }

    const handleTrackPointerDown = (event: PointerEvent) => {
      if (event.target === thumb) return
      const rect = track.getBoundingClientRect()
      const clickY = event.clientY - rect.top
      const trackHeight = rect.height
      const thumbHeight = thumb.clientHeight
      const maxThumbTop = trackHeight - thumbHeight
      const scrollable = content.scrollHeight - content.clientHeight

      if (scrollable <= 0 || maxThumbTop <= 0) return

      const targetThumbTop = Math.min(
        Math.max(0, clickY - thumbHeight / 2),
        maxThumbTop,
      )
      const targetScrollTop = (targetThumbTop / maxThumbTop) * scrollable

      content.scrollTop = targetScrollTop
    }

    const handlePointerDownX = (event: PointerEvent) => {
      if (!trackX || !thumbX) return
      event.preventDefault()
      draggingX = true
      root.classList.add("is-dragging-x")
      startX = event.clientX
      startScrollLeft = content.scrollLeft

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!draggingX) return
        const trackWidth = trackX.clientWidth
        const thumbWidth = thumbX.clientWidth
        const maxThumbLeft = trackWidth - thumbWidth
        const scrollable = content.scrollWidth - content.clientWidth

        if (scrollable <= 0 || maxThumbLeft <= 0) return

        const delta = moveEvent.clientX - startX
        const ratio = scrollable / maxThumbLeft
        const nextScrollLeft = startScrollLeft + delta * ratio

        content.scrollLeft = Math.max(0, Math.min(scrollable, nextScrollLeft))
      }

      const handlePointerUp = () => {
        draggingX = false
        root.classList.remove("is-dragging-x")
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
      }

      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
    }

    const handleTrackPointerDownX = (event: PointerEvent) => {
      if (!trackX || !thumbX || event.target === thumbX) return
      const rect = trackX.getBoundingClientRect()
      const clickX = event.clientX - rect.left
      const trackWidth = rect.width
      const thumbWidth = thumbX.clientWidth
      const maxThumbLeft = trackWidth - thumbWidth
      const scrollable = content.scrollWidth - content.clientWidth

      if (scrollable <= 0 || maxThumbLeft <= 0) return

      const targetThumbLeft = Math.min(
        Math.max(0, clickX - thumbWidth / 2),
        maxThumbLeft,
      )
      const targetScrollLeft = (targetThumbLeft / maxThumbLeft) * scrollable

      content.scrollLeft = targetScrollLeft
    }

    thumb.addEventListener("pointerdown", handlePointerDown)
    track.addEventListener("pointerdown", handleTrackPointerDown)

    if (trackX && thumbX && showHorizontal) {
      thumbX.addEventListener("pointerdown", handlePointerDownX)
      trackX.addEventListener("pointerdown", handleTrackPointerDownX)
    }

    return () => {
      if (frame) cancelAnimationFrame(frame)
      content.removeEventListener("scroll", handleScroll)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener("resize", handleWindowResize)
      thumb.removeEventListener("pointerdown", handlePointerDown)
      track.removeEventListener("pointerdown", handleTrackPointerDown)
      if (trackX && thumbX && showHorizontal) {
        thumbX.removeEventListener("pointerdown", handlePointerDownX)
        trackX.removeEventListener("pointerdown", handleTrackPointerDownX)
      }
    }
  }, [showHorizontal])

  const rootStyle = maxHeight ? { maxHeight, height: maxHeight } : undefined
  const contentStyle = maxHeight ? { height: maxHeight } : undefined

  return (
    <div className={`scroll-area ${className}`} ref={rootRef} style={rootStyle}>
      {showHorizontal && (
        <div
          className="scroll-area__track scroll-area__track--x"
          ref={trackXRef}
        >
          <div
            className="scroll-area__thumb scroll-area__thumb--x"
            ref={thumbXRef}
          />
        </div>
      )}
      <div
        className="scroll-area__viewport"
        ref={contentRef}
        style={contentStyle}
      >
        <div className="scroll-area__content">{children}</div>
      </div>
      <div className="scroll-area__track" ref={trackRef}>
        <div className="scroll-area__thumb" ref={thumbRef} />
      </div>
    </div>
  )
}
