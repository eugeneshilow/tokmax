'use client'

import { useState } from 'react'

// The command INSIDE the screenshot crop: every shared card must tell the
// viewer what to run, in CLI-green so it reads as a command, not a link.
// On the live page a click copies it.
export function NpxChip({ command = 'npx tokmax' }: { command?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(command).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      title="click to copy"
      className="inline-flex items-center gap-2 rounded-md border border-[#18D86B]/60 bg-[#18D86B]/10 px-2.5 py-1 font-mono text-[12px] font-black text-[#18D86B] transition-colors hover:bg-[#18D86B]/20"
    >
      {copied ? '✓ copied' : `$ ${command}`}
    </button>
  )
}
