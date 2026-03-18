/**
 * Leaf Design System — SVG icon library.
 * Two primary icons: LeafIcon (pages) and DatabaseIcon (databases).
 * Plus small block-type tiles for the slash command menu.
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
        d="M13 2C13 2 8.5 1.5 5.5 4.5C3 7 3 11 5 13.5L6.5 12C5 10 5.5 7.5 7 6C8.5 4.5 11.5 3.5 13 2Z"
        fill="currentColor"
        fillOpacity="0.85"
      />
      <path
        d="M5.5 12.5L3 15"
        stroke="currentColor"
        strokeWidth="1.5"
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
      strokeWidth="1.25"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <ellipse cx="8" cy="4.5" rx="5.5" ry="2" />
      <path d="M2.5 4.5V8c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2V4.5" />
      <path d="M2.5 8v3.5c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2V8" />
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
        'inline-flex items-center justify-center w-7 h-7 rounded-md text-[11px] font-medium text-leaf-500 bg-leaf-100 shrink-0 select-none',
        className ?? '',
      ].join(' ')}
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
  subpage: (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-leaf-100 shrink-0">
      <LeafIcon size={14} className="text-leaf-500" />
    </span>
  ),
  database: (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-leaf-100 shrink-0">
      <DatabaseIcon size={14} className="text-leaf-500" />
    </span>
  ),
}
