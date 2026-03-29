/**
 * Leaf UI: SVG icon library (`frontend/src/components/Icons.tsx`).
 *
 * Purpose:
 * - Centralizes reusable SVG/icon components so UI stays consistent.
 * - Includes:
 *   - `LeafIcon` (pages)
 *   - `DatabaseIcon` (databases)
 *   - `ShapeIcon` (small geometric icons for styling)
 *   - `BlockIcon`/`BLOCK_ICONS` tiles used by the slash command menu
 *
 * How to read:
 * - Each icon is a pure React component returning SVG/JSX.
 * - `BLOCK_ICONS` maps editor block actions to icon tiles used in `SlashCommands`.
 *
 * Update:
 * - To add a new slash-command icon tile, extend `BLOCK_ICONS` with the new action key.
 * - To add a new geometric icon, update `LeafShapeIcon` and implement a case in `ShapeIcon`.
 *
 * Debug:
 * - If an icon doesn’t render:
 *   - check whether it’s exported and imported correctly
 *   - verify the slash action key matches the `BLOCK_ICONS[...]` lookup.
 */


type IconProps = { className?: string; size?: number }
export type LeafShapeIcon =
  | 'diamond-fill'
  | 'circle-fill'
  | 'triangle-fill'
  | 'diamond-outline'
  | 'circle-outline'
  | 'triangle-outline'

// ─── Primary icons ────────────────────────────────────────────────────────────

export function LeafIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M4.5 2.75H9.1L11.75 5.38V13.25H4.5V2.75Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M8.9 2.75V5.55H11.75"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M6 8.1H10.1M6 10.35H9.1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function DatabaseIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M2 6h12M2 10h12M6 2v12" />
    </svg>
  )
}

export function ShapeIcon({ shape, className, size = 16 }: IconProps & { shape: LeafShapeIcon }) {
  const color = shape.includes('outline') ? 'var(--leaf-green-light)' : 'var(--leaf-green)'

  if (shape.startsWith('diamond')) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <path
          d="M8 2.25L13.75 8L8 13.75L2.25 8L8 2.25Z"
          fill={shape.endsWith('fill') ? color : 'none'}
          stroke={color}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (shape.startsWith('circle')) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <circle
          cx="8"
          cy="8"
          r="5.25"
          fill={shape.endsWith('fill') ? color : 'none'}
          stroke={color}
          strokeWidth="1.3"
        />
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M8 3L13 12H3L8 3Z"
        fill={shape.endsWith('fill') ? color : 'none'}
        stroke={color}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Slash-menu block-type tiles ──────────────────────────────────────────────

export function BlockIcon({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={[
        'inline-flex items-center justify-center w-7 h-7 rounded-md text-[11px] font-medium shrink-0 select-none',
        className ?? '',
      ].join(' ')}
      style={{
        color: 'var(--leaf-text-sidebar)',
        background: 'rgba(244,244,245,0.82)',
        border: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      {label}
    </span>
  )
}

// Pre-built tiles for each slash command item
export const BLOCK_ICONS: Record<string, React.ReactNode> = {
  h1:      <BlockIcon label="H1" />,
  h2:      <BlockIcon label="H2" />,
  h3:      <BlockIcon label="H3" />,
  bold:    <BlockIcon label="B" />,
  italic:  <BlockIcon label="I" />,
  strike:  <BlockIcon label="S̶" />,
  code:    <BlockIcon label="<>" />,
  bullet:  <BlockIcon label="•" />,
  ordered: <BlockIcon label="1." />,
  todo:    <BlockIcon label="☐" />,
  quote:   <BlockIcon label='"' />,
  columns2: <BlockIcon label="2C" />,
  columns3: <BlockIcon label="3C" />,
  columns4: <BlockIcon label="4C" />,
  columns5: <BlockIcon label="5C" />,
  statStrip: <BlockIcon label="≡" />,
  align_left: <BlockIcon label="L" />,
  align_center: <BlockIcon label="C" />,
  align_right: <BlockIcon label="R" />,
  textColor_clear: <BlockIcon label="A" />,
  storyTag_combat: <BlockIcon label="⚔" />,
  storyTag_political: <BlockIcon label="◎" />,
  storyTag_character: <BlockIcon label="◇" />,
  storyTag_lore: <BlockIcon label="✦" />,
  storyTag_environment: <BlockIcon label="⌂" />,
  storyTag_boss: <BlockIcon label="☠" />,
  storyTag_neutral: <BlockIcon label="◇" />,
  subpage: (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0" style={{ background: 'rgba(244,244,245,0.82)', border: '1px solid rgba(0,0,0,0.06)' }}>
      <LeafIcon size={14} className="text-[var(--leaf-text-body)]" />
    </span>
  ),
  database: (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0" style={{ background: 'rgba(244,244,245,0.82)', border: '1px solid rgba(0,0,0,0.06)' }}>
      <DatabaseIcon size={14} className="text-[var(--leaf-text-body)]" />
    </span>
  ),
  toggleCard: <BlockIcon label="▾" />,
  callout_gray: <BlockIcon label="▢" />,
  callout_blue: <BlockIcon label="▢" />,
  callout_red: <BlockIcon label="▢" />,
  callout_yellow: <BlockIcon label="▢" />,
  callout_green: <BlockIcon label="▢" />,
  callout_flavor: <BlockIcon label="→" />,
}
