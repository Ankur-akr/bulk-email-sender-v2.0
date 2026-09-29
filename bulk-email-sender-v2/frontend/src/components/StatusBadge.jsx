import React from 'react'

const STYLES = {
  pending:   'bg-slate-100 text-slate-600',
  sending:   'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
  sent:      'bg-green-100 text-green-700',
}

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${STYLES[status] || STYLES.pending}`}>
      {status}
    </span>
  )
}
