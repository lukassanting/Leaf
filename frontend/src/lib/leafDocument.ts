/**
 * Leaf frontend: Leaf document utilities (`frontend/src/lib/leafDocument.ts`).
 *
 * Purpose:
 * - Defines the client-side handling of editor “document” payloads that are sent to/received from the backend.
 * - Provides conversion helpers between:
 *   - JSON LeafDocument (TipTap-like schema) and legacy HTML-ish strings
 *   - content -> plain text (for search/count)
 *   - content -> extracted wikilinks (for graph/backlinks previews)
 *
 * How to read:
 * - `parseLeafContent(...)` is the main entry: it normalizes API content into a `LeafDocument`.
 * - `getLeafContentText(...)` walks blocks/inline nodes to create a searchable plain-text representation.
 * - `extractLeafWikilinks(...)` collects wikilink nodes from the document tree.
 *
 * Update:
 * - If you add new node/mark types, update the `LeafNode`/`LeafInlineNode` types in `lib/api/types.ts` and extend:
 *   - `getLeafContentText` walker
 *   - `extractLeafWikilinks` walker
 *   - legacy migration in `migrateLegacyHtmlToLeafDocument`
 *
 * Debug:
 * - If editing loses content: check `parseLeafContent` normalization and how `LeafEditor` sets `content`.
 * - If wikilinks are missing: verify the editor emits `wikilink` inline nodes with expected attrs.
 */
import type {
  LeafContent,
  LeafDocument,
  LeafInlineNode,
  LeafMark,
  LeafNode,
  LeafTextNode,
  StoryTagVariant,
} from '@/lib/api'
import { STORY_TAG_VARIANTS } from '@/lib/editorRichText'

function blockTextAlignFromStyle(el: HTMLElement): { textAlign?: string } | undefined {
  const ta = el.style.textAlign
  if (!ta || ta === 'start' || ta === 'left' || ta === '') return undefined
  return { textAlign: ta }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateNode(node: any): any {
  if (!node || typeof node !== 'object') return node

  // Migrate old columnLayout → columnList + column children
  if (node.type === 'columnLayout' && node.attrs?.columns) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const columns = node.attrs.columns as any[]
    return {
      type: 'columnList',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: columns.map((col: any) => {
        let content: unknown[]
        if (col.content?.content && Array.isArray(col.content.content)) {
          content = col.content.content.map(migrateNode)
        } else if (col.text) {
          content = [{ type: 'paragraph', content: [{ type: 'text', text: col.text }] }]
        } else {
          content = [{ type: 'paragraph' }]
        }
        return { type: 'column', content }
      }),
    }
  }

  // Migrate old toggleCard with header attrs → content child nodes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (node.type === 'toggleCard' && node.attrs && !node.content?.some((c: any) => c.type === 'toggleCardEyebrow')) {
    const eyebrowText = node.attrs.eyebrow || ''
    const titleText = node.attrs.title || 'Toggle card'
    const subtitleText = node.attrs.subtitle || ''
    const textNode = (t: string) => t ? [{ type: 'text', text: t }] : undefined
    const bodyContent = Array.isArray(node.content) ? node.content.map(migrateNode) : [{ type: 'paragraph' }]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { eyebrow, title, subtitle, eyebrowColor, titleColor, subtitleColor, ...keepAttrs } = node.attrs
    return {
      type: 'toggleCard',
      attrs: keepAttrs,
      content: [
        { type: 'toggleCardEyebrow', content: textNode(eyebrowText) },
        { type: 'toggleCardTitle', content: textNode(titleText) },
        { type: 'toggleCardSubtitle', content: textNode(subtitleText) },
        ...bodyContent,
      ],
    }
  }

  // Recursively process content arrays
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map(migrateNode) }
  }

  return node
}

export const LEAF_DOCUMENT_VERSION = 1

export function createEmptyLeafDocument(): LeafDocument {
  return {
    type: 'doc',
    version: LEAF_DOCUMENT_VERSION,
    content: [{ type: 'paragraph' }],
  }
}

export function isLeafDocument(value: unknown): value is LeafDocument {
  return Boolean(
    value
    && typeof value === 'object'
    && (value as LeafDocument).type === 'doc'
    && typeof (value as LeafDocument).version === 'number'
    && Array.isArray((value as LeafDocument).content),
  )
}

export function normalizeLeafDocument(document: LeafDocument): LeafDocument {
  const migrated = document.content.length
    ? document.content.map(migrateNode) as LeafNode[]
    : [{ type: 'paragraph' } as LeafNode]
  return {
    type: 'doc',
    version: LEAF_DOCUMENT_VERSION,
    content: migrated,
  }
}

export function parseLeafContent(content: LeafContent | null | undefined): LeafDocument {
  if (!content) {
    return createEmptyLeafDocument()
  }

  if (isLeafDocument(content)) {
    return normalizeLeafDocument(content)
  }

  if (typeof content !== 'string') {
    return createEmptyLeafDocument()
  }

  const trimmed = content.trim()
  if (!trimmed) {
    return createEmptyLeafDocument()
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (isLeafDocument(parsed)) {
      return normalizeLeafDocument(parsed)
    }
  } catch {
    // Fall back to legacy HTML migration.
  }

  return migrateLegacyHtmlToLeafDocument(trimmed)
}

/** Toggle card header attrs may store TipTap HTML; strip tags for plain-text search. */
function plainTextFromToggleAttr(value: unknown): string {
  const s = String(value ?? '').trim()
  if (!s) return ''
  if (!s.includes('<')) return s
  if (typeof document === 'undefined') {
    return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const el = document.createElement('div')
  el.innerHTML = s
  return (el.textContent || '').replace(/\s+/g, ' ').trim()
}

export function getLeafContentText(document: LeafDocument): string {
  const parts: string[] = []

  const walkInline = (nodes?: LeafInlineNode[]) => {
    for (const node of nodes ?? []) {
      if (node.type === 'text') {
        parts.push(node.text)
      } else if (node.type === 'wikilink') {
        parts.push(`[[${node.attrs.label || node.attrs.path || node.attrs.id}]]`)
      } else if (node.type === 'hashtag') {
        parts.push(`#${node.attrs.tag || ''}`)
      } else if (node.type === 'hardBreak') {
        parts.push('\n')
      } else if (node.type === 'storyTag') {
        parts.push(`[${node.attrs.label}]`)
      }
    }
  }

  const walkBlocks = (nodes: LeafNode[]) => {
    for (const node of nodes) {
      switch (node.type) {
        case 'paragraph':
        case 'heading':
          walkInline(node.content)
          parts.push('\n')
          break
        case 'blockquote':
          walkBlocks(node.content)
          break
        case 'callout':
          if ('content' in node && node.content) walkBlocks(node.content)
          parts.push('\n')
          break
        case 'table':
          if ('content' in node && node.content) {
            for (const row of node.content) {
              if (row.type === 'tableRow' && 'content' in row && row.content) {
                for (const cell of row.content) {
                  if ('content' in cell && cell.content) walkBlocks(cell.content as LeafNode[])
                  parts.push(' | ')
                }
                parts.push('\n')
              }
            }
          }
          parts.push('\n')
          break
        case 'tableRow':
          if ('content' in node && node.content) walkBlocks(node.content as LeafNode[])
          break
        case 'tableCell':
        case 'tableHeader':
          if ('content' in node && node.content) walkBlocks(node.content as LeafNode[])
          break
        case 'bulletList':
        case 'orderedList':
          node.content.forEach((item) => walkBlocks(item.content))
          break
        case 'taskList':
          node.content.forEach((item) => walkBlocks(item.content))
          break
        case 'codeBlock':
          walkInline(node.content)
          parts.push('\n')
          break
        case 'columnList':
          node.content.forEach((column) => {
            if (column.content) {
              walkBlocks(column.content)
            }
          })
          break
        case 'toggleCard': {
          const attrs = 'attrs' in node && node.attrs ? (node.attrs as Record<string, unknown>) : {}
          for (const key of ['eyebrow', 'title', 'subtitle'] as const) {
            const t = plainTextFromToggleAttr(attrs[key])
            if (t) {
              parts.push(t)
              parts.push('\n')
            }
          }
          if ('content' in node && node.content) walkBlocks(node.content)
          break
        }
        case 'pageEmbed':
        case 'databaseEmbed':
          parts.push(node.attrs.title)
          parts.push('\n')
          break
        case 'horizontalRule':
          parts.push('\n')
          break
        case 'statStrip': {
          const a = node.attrs as Record<string, string | number | undefined>
          const cols = Math.min(6, Math.max(2, Number(a.columns) || 3))
          const lines: string[] = []
          for (let i = 0; i < cols; i++) {
            const line = `${String(a[`kicker${i}`] ?? '')} ${String(a[`title${i}`] ?? '')}`.trim()
            if (line) lines.push(line)
          }
          parts.push(lines.join(' · '))
          parts.push('\n')
          break
        }
        case 'image': {
          const a = node.attrs as { alt?: string | null; src?: string }
          parts.push(String(a.alt || a.src || 'image'))
          parts.push('\n')
          break
        }
        case 'linkCard': {
          const a = node.attrs as { title?: string; url?: string }
          parts.push(String(a.title || a.url || 'link'))
          parts.push('\n')
          break
        }
      }
    }
  }

  walkBlocks(document.content)
  return parts.join('').trim()
}

export function extractLeafWikilinks(document: LeafDocument): { id?: string; path?: string; label: string }[] {
  const links: { id?: string; path?: string; label: string }[] = []

  const walkInline = (nodes?: LeafInlineNode[]) => {
    for (const node of nodes ?? []) {
      if (node.type === 'wikilink') {
        links.push({
          id: node.attrs.id || undefined,
          path: node.attrs.path || undefined,
          label: node.attrs.label,
        })
      }
    }
  }

  const walkBlocks = (nodes: LeafNode[]) => {
    for (const node of nodes) {
      switch (node.type) {
        case 'paragraph':
        case 'heading':
          walkInline(node.content)
          break
        case 'blockquote':
          walkBlocks(node.content)
          break
        case 'bulletList':
        case 'orderedList':
          node.content.forEach((item) => walkBlocks(item.content))
          break
        case 'taskList':
          node.content.forEach((item) => walkBlocks(item.content))
          break
        case 'columnList':
          node.content.forEach((column) => {
            if (column.content) walkBlocks(column.content)
          })
          break
        case 'toggleCard':
          if ('content' in node && node.content) walkBlocks(node.content)
          break
        case 'callout':
          if ('content' in node && node.content) walkBlocks(node.content)
          break
        case 'table':
          if ('content' in node && node.content) {
            for (const row of node.content) {
              if (row.type === 'tableRow' && 'content' in row && row.content) {
                walkBlocks(row.content as LeafNode[])
              }
            }
          }
          break
        case 'tableRow':
        case 'tableCell':
        case 'tableHeader':
          if ('content' in node && node.content) walkBlocks(node.content as LeafNode[])
          break
        case 'codeBlock':
          walkInline(node.content)
          break
        case 'statStrip':
          break
        default:
          break
      }
    }
  }

  walkBlocks(document.content)
  return links
}

function migrateLegacyHtmlToLeafDocument(html: string): LeafDocument {
  if (typeof DOMParser === 'undefined') {
    return createFallbackDocument(html)
  }

  const parser = new DOMParser()
  const parsed = parser.parseFromString(html, 'text/html')
  const content = Array.from(parsed.body.childNodes)
    .flatMap((node) => parseBlockNode(node))
    .filter(Boolean) as LeafNode[]

  return normalizeLeafDocument({
    type: 'doc',
    version: LEAF_DOCUMENT_VERSION,
    content,
  })
}

function createFallbackDocument(text: string): LeafDocument {
  return normalizeLeafDocument({
    type: 'doc',
    version: LEAF_DOCUMENT_VERSION,
    content: [
      {
        type: 'paragraph',
        content: textContentToInline(text.replace(/<[^>]+>/g, ' ')),
      },
    ],
  })
}

function parseBlockNode(node: ChildNode): LeafNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim()
    return text ? [{ type: 'paragraph', content: textContentToInline(text) }] : []
  }

  if (!(node instanceof HTMLElement)) {
    return []
  }

  const tag = node.tagName.toLowerCase()

  if (tag === 'p') {
    const align = blockTextAlignFromStyle(node)
    return [{
      type: 'paragraph',
      ...(align ? { attrs: align } : {}),
      content: parseInlineNodes(node.childNodes),
    }]
  }

  if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
    const align = blockTextAlignFromStyle(node)
    return [{
      type: 'heading',
      attrs: { level: Number(tag[1]) as 1 | 2 | 3, ...(align ?? {}) },
      content: parseInlineNodes(node.childNodes),
    }]
  }

  if (tag === 'blockquote') {
    const align = blockTextAlignFromStyle(node)
    const children = Array.from(node.childNodes).flatMap((child) => parseBlockNode(child))
    return [{
      type: 'blockquote',
      ...(align ? { attrs: align } : {}),
      content: children.length ? children : [{ type: 'paragraph' }],
    }]
  }

  if (tag === 'ul' && node.dataset.type === 'taskList') {
    const items = Array.from(node.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName.toLowerCase() === 'li')
      .map((child) => {
        const textContainer = child.querySelector('div') ?? child
        return {
          type: 'taskItem' as const,
          attrs: { checked: child.dataset.checked === 'true' },
          content: [{ type: 'paragraph' as const, content: parseInlineNodes(textContainer.childNodes) }],
        }
      })
    return items.length ? [{ type: 'taskList', content: items }] : []
  }

  if (tag === 'ul' || tag === 'ol') {
    const listType = tag === 'ul' ? 'bulletList' : 'orderedList'
    const items = Array.from(node.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName.toLowerCase() === 'li')
      .map((child) => ({
        type: 'listItem' as const,
        content: parseListItemContent(child),
      }))
    return items.length ? [{ type: listType, content: items }] : []
  }

  if (tag === 'pre') {
    const code = node.querySelector('code')?.textContent ?? node.textContent ?? ''
    return [{ type: 'codeBlock', content: textContentToInline(code) as LeafTextNode[] }]
  }

  if (tag === 'table') {
    const tableEl = node as HTMLTableElement
    const rowNodes: LeafNode[] = []
    for (const tr of Array.from(tableEl.querySelectorAll('tr'))) {
      if (!(tr instanceof HTMLTableRowElement)) continue
      const cells: LeafNode[] = []
      for (const cell of Array.from(tr.cells)) {
        const inner = Array.from(cell.childNodes).flatMap((child) => parseBlockNode(child))
        const cellContent = inner.length ? inner : [{ type: 'paragraph' as const, content: [] as LeafInlineNode[] }]
        const isHeader = cell.tagName.toLowerCase() === 'th'
        cells.push({
          type: isHeader ? 'tableHeader' : 'tableCell',
          content: cellContent,
        } as LeafNode)
      }
      if (cells.length) rowNodes.push({ type: 'tableRow', content: cells } as LeafNode)
    }
    return rowNodes.length ? [{ type: 'table', content: rowNodes } as LeafNode] : []
  }

  if (tag === 'hr') {
    return [{ type: 'horizontalRule' }]
  }

  if (tag === 'div' && node.dataset.type === 'stat-strip') {
    const g = (name: string) => node.getAttribute(`data-${name}`) ?? ''
    const columns = parseInt(g('columns') || '3', 10) || 3
    return [{
      type: 'statStrip',
      attrs: {
        columns,
        variant: g('variant') || 'gray',
        kicker0: g('kicker0'),
        title0: g('title0'),
        kicker1: g('kicker1'),
        title1: g('title1'),
        kicker2: g('kicker2'),
        title2: g('title2'),
        kicker3: g('kicker3'),
        title3: g('title3'),
        kicker4: g('kicker4'),
        title4: g('title4'),
        kicker5: g('kicker5'),
        title5: g('title5'),
      },
    }]
  }

  if (tag === 'div' && node.dataset.type === 'page-card') {
    const id = node.getAttribute('id') ?? ''
    const title = node.getAttribute('title') ?? 'Untitled'
    if (node.getAttribute('kind') === 'database') {
      return [{ type: 'databaseEmbed', attrs: { id, title, kind: 'database' } }]
    }
    return [{ type: 'pageEmbed', attrs: { id, title, kind: 'page' } }]
  }

  if (tag === 'div' && node.dataset.type === 'callout') {
    const variant = node.getAttribute('data-variant') || 'green'
    const children = Array.from(node.childNodes).flatMap((child) => parseBlockNode(child))
    return [{
      type: 'callout',
      attrs: { variant },
      content: children.length ? children : [{ type: 'paragraph' }],
    }]
  }

  if (tag === 'div' || tag === 'section' || tag === 'article') {
    const children = Array.from(node.childNodes).flatMap((child) => parseBlockNode(child))
    return children.length ? children : []
  }

  const fallback = node.textContent?.trim()
  return fallback ? [{ type: 'paragraph', content: textContentToInline(fallback) }] : []
}

function parseListItemContent(node: HTMLElement): LeafNode[] {
  const directBlocks = Array.from(node.childNodes).flatMap((child) => parseBlockNode(child))
  return directBlocks.length ? directBlocks : [{ type: 'paragraph', content: parseInlineNodes(node.childNodes) }]
}

function parseInlineNodes(
  nodes: NodeListOf<ChildNode> | ChildNode[],
  marks: LeafMark[] = [],
): LeafInlineNode[] {
  const result: LeafInlineNode[] = []

  Array.from(nodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (text) {
        result.push({
          type: 'text',
          text,
          ...(marks.length ? { marks } : {}),
        })
      }
      return
    }

    if (!(node instanceof HTMLElement)) {
      return
    }

    const tag = node.tagName.toLowerCase()
    if (tag === 'br') {
      result.push({ type: 'hardBreak' })
      return
    }

    if (tag === 'a' && node.dataset.type === 'wikilink') {
      result.push({
        type: 'wikilink',
        attrs: {
          id: node.dataset.id ?? '',
          label: node.dataset.label ?? node.textContent?.replace(/^\[\[|\]\]$/g, '') ?? '',
          path: node.dataset.path ?? '',
        },
      })
      return
    }

    if (tag === 'span' && node.dataset.type === 'story-tag') {
      const raw = node.dataset.variant ?? 'neutral'
      const variant = (STORY_TAG_VARIANTS as readonly string[]).includes(raw)
        ? (raw as StoryTagVariant)
        : 'neutral'
      result.push({
        type: 'storyTag',
        attrs: {
          label: node.dataset.label ?? node.textContent?.trim() ?? 'Gray',
          variant,
        },
      })
      return
    }

    if (tag === 'span' && node.style?.color) {
      const color = node.style.color
      result.push(
        ...parseInlineNodes(Array.from(node.childNodes), [...marks, { type: 'textStyle', attrs: { color } }]),
      )
      return
    }

    const nextMarks = getMarksForTag(tag, marks)
    result.push(...parseInlineNodes(Array.from(node.childNodes), nextMarks))
  })

  return normalizeInlineNodes(result)
}

function getMarksForTag(tag: string, marks: LeafMark[]): LeafMark[] {
  const nextMarks = [...marks]
  const markType =
    tag === 'strong' || tag === 'b' ? 'bold'
      : tag === 'em' || tag === 'i' ? 'italic'
        : tag === 's' || tag === 'strike' || tag === 'del' ? 'strike'
          : tag === 'code' ? 'code'
            : null

  if (!markType || nextMarks.some((mark) => mark.type === markType)) {
    return nextMarks
  }

  nextMarks.push({ type: markType })
  return nextMarks
}

function textContentToInline(text: string): LeafInlineNode[] {
  return normalizeInlineNodes(text ? [{ type: 'text', text }] : [])
}

function normalizeInlineNodes(nodes: LeafInlineNode[]): LeafInlineNode[] {
  const normalized: LeafInlineNode[] = []

  nodes.forEach((node) => {
    if (node.type !== 'text') {
      normalized.push(node)
      return
    }

    const text = node.text.replace(/\u00a0/g, ' ')
    if (!text) {
      return
    }

    const previous = normalized.at(-1)
    const marksKey = JSON.stringify(node.marks ?? [])
    const previousMarksKey = previous?.type === 'text' ? JSON.stringify(previous.marks ?? []) : null

    if (previous?.type === 'text' && previousMarksKey === marksKey) {
      previous.text += text
      return
    }

    normalized.push({ ...node, text })
  })

  return normalized
}
