'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export function PromptCopyBox({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false)

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="border border-white/14 bg-[#111111] text-white">
      <div className="flex flex-col gap-3 border-b border-white/14 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#A1A1A6]">
            copy command
          </p>
          <h3 className="mt-1 text-[20px] font-black leading-tight">Run it in your terminal</h3>
        </div>
        <button
          type="button"
          onClick={copyPrompt}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white px-3 text-[13px] font-black text-[#070707] transition-colors hover:bg-[#E8E8ED]"
        >
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap p-4 font-mono text-[13px] font-semibold leading-6 text-[#D2D2D7]">
        {prompt}
      </pre>
    </div>
  )
}
