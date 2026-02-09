"use client"

import type { ReactNode } from "react"
import ScrollArea from "@/components/ScrollArea"

interface ScrollPageProps {
  children: ReactNode
}

export default function ScrollPage({ children }: ScrollPageProps) {
  return <ScrollArea className="app-scroll">{children}</ScrollArea>
}
