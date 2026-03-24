import { LEAF_DESIGN_STORAGE_KEY } from '@/lib/designTheme'

/**
 * Runs before paint to apply saved design theme and avoid a flash of the default theme.
 * Must be included in the root layout inside <head> or early in <body>.
 */
export function DesignThemeScript() {
  const key = JSON.stringify(LEAF_DESIGN_STORAGE_KEY)
  const js = `try{var d=localStorage.getItem(${key});if(d==='campaign')document.documentElement.setAttribute('data-leaf-design','campaign');else document.documentElement.removeAttribute('data-leaf-design');}catch(e){}`
  return <script dangerouslySetInnerHTML={{ __html: js }} />
}
