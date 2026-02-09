"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ConfigsRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/game-settings")
  }, [router])

  return null
}
