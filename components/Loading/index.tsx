import { Sword } from "lucide-react"
import "./Loading.sass"

interface LoadingProps {
  label?: string
  compact?: boolean
  light?: boolean
}

export default function Loading({
  label = "Loading...",
  compact = false,
  light = false,
}: LoadingProps) {
  return (
    <div
      className={`loading ${compact ? "loading--compact" : ""} ${light ? "loading--light" : ""}`.trim()}
      role="status"
      aria-live="polite"
    >
      <Sword className="loading__icon" />
      {label ? <span className="loading__label">{label}</span> : null}
    </div>
  )
}
