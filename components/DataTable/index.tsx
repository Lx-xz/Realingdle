import React from "react"

interface TableColumn {
  key: string
  label: string
  className?: string
}

interface DataTableProps {
  className?: string
  columns: TableColumn[]
  children: React.ReactNode
}

export default function DataTable({
  className,
  columns,
  children,
}: DataTableProps) {
  return (
    <table className={className}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} className={column.className}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}
