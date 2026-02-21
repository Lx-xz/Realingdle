import { GamePageContent } from "../page"

interface GameDatePageProps {
  params: Promise<{ date: string }>
}

const formatDate = (value: Date) => {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, "0")
  const day = String(value.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function generateStaticParams() {
  const today = new Date()
  const start = new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1))
  const end = new Date(Date.UTC(today.getUTCFullYear() + 1, 11, 31))
  const dates: { date: string }[] = []

  for (
    const cursor = new Date(start);
    cursor.getTime() <= end.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    dates.push({ date: formatDate(cursor) })
  }

  return dates
}

export default async function GameDatePage({ params }: GameDatePageProps) {
  const { date } = await params
  return <GamePageContent forcedDate={date} />
}
