import type { ReactNode } from 'react'

// Money Terminal signature surface (decision-log 2026-07-02): every branded
// card is a fake terminal window — traffic lights, mono title bar, optional
// orange edge-glow so the card doesn't sink into a dark-mode X feed.
// `tone`: dark = share-artifact surfaces; paper = light data zones (tables)
// that keep the dark chrome header on top.

type TerminalCardProps = {
  title: string
  children: ReactNode
  glow?: boolean
  live?: boolean
  tone?: 'dark' | 'paper'
  className?: string
}

export function TerminalCard({
  title,
  children,
  glow = false,
  live = false,
  tone = 'dark',
  className = '',
}: TerminalCardProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[#242428] ${
        glow
          ? 'shadow-[0_0_0_1px_rgba(255,122,26,0.35),0_0_44px_rgba(255,122,26,0.16)]'
          : ''
      } ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-[#242428] bg-[#111111] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-center font-mono text-[12px] font-bold text-[#6E6E73]">
          {title}
        </span>
        {live ? (
          <span className="flex items-center gap-1.5 font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#FF7A1A]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF7A1A]" />
            live
          </span>
        ) : (
          <span className="w-[46px]" aria-hidden />
        )}
      </div>
      <div className={tone === 'paper' ? 'bg-white text-[#1D1D1F]' : 'bg-[#0B0B0C]'}>
        {children}
      </div>
    </div>
  )
}

/** The canonical `$ npx tokmax` prompt line with a blinking block cursor. */
export function TerminalPrompt({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-[26px] md:text-[34px]' : 'text-[16px]'
  return (
    <p className={`flex items-center gap-3 font-mono font-bold leading-none ${text}`}>
      <span className="text-[#6E6E73]">$</span>
      <span className="text-white">npx tokmax</span>
      <span className="inline-block h-[1em] w-[0.55em] animate-pulse bg-[#FF7A1A]" aria-hidden />
    </p>
  )
}
