declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown'

  export function tables(service: TurndownService): void
}
