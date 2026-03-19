import { expect, test, type APIRequestContext } from '@playwright/test'

const apiBaseURL = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000'
const uniqueTitle = (prefix: string) => `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 6)}`

async function createLeaf(request: APIRequestContext, title: string, parentId?: string) {
  const response = await request.post(`${apiBaseURL}/leaves`, {
    data: {
      title,
      ...(parentId ? { parent_id: parentId } : {}),
    },
  })
  expect(response.ok()).toBeTruthy()
  return response.json()
}

async function createDatabase(request: APIRequestContext, title: string, parentLeafId?: string) {
  const response = await request.post(`${apiBaseURL}/databases`, {
    data: {
      title,
      ...(parentLeafId ? { parent_leaf_id: parentLeafId } : {}),
    },
  })
  expect(response.ok()).toBeTruthy()
  return response.json()
}

async function createRow(request: APIRequestContext, databaseId: string) {
  const response = await request.post(`${apiBaseURL}/databases/${databaseId}/rows`, {
    data: { properties: {} },
  })
  expect(response.ok()).toBeTruthy()
  return response.json()
}

async function patchLeafContent(request: APIRequestContext, leafId: string, content: unknown) {
  const response = await request.patch(`${apiBaseURL}/leaves/${leafId}/content`, {
    data: { content },
  })
  expect(response.ok()).toBeTruthy()
  return response.json()
}

test.describe('Leaf workspace', () => {
  test.skip(process.env.PLAYWRIGHT_E2E !== '1', 'Set PLAYWRIGHT_E2E=1 to run against a live app')
  test.describe.configure({ timeout: 90_000 })

  test('create/open page, type, reload, and persist content', async ({ page, request }) => {
    const leaf = await createLeaf(request, 'E2E persisted page')

    await page.goto(`/editor/${leaf.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.locator('.ProseMirror').click()
    await page.keyboard.type('This text should persist after reload.')
    await expect(page.getByText('Synced')).toBeVisible()

    await page.reload()
    await expect(page.locator('.ProseMirror')).toContainText('This text should persist after reload.')
  })

  test('slash menu inserts page and database embeds without runtime errors', async ({ page, request }) => {
    const leaf = await createLeaf(request, uniqueTitle('Slash embed page'))
    const pageErrors: string[] = []
    const consoleErrors: string[] = []

    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto(`/editor/${leaf.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.locator('.ProseMirror').click()

    await page.keyboard.type('/sub')
    await expect(page.getByText('Sub-page')).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('.ProseMirror')).toContainText(/Creating page|Page/)

    await page.keyboard.type('/data')
    await expect(page.getByRole('button', { name: /Database New table database/ })).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('.ProseMirror')).toContainText(/Creating database|Inline database|Table/)

    expect(pageErrors).toEqual([])
    expect(consoleErrors.filter((message) => /localsInner|reading 'eq'|prosemirror-view/i.test(message))).toEqual([])
  })

  test('todo list enter flow stays interactive', async ({ page, request }) => {
    const leaf = await createLeaf(request, 'Todo editor page')
    const pageErrors: string[] = []

    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto(`/editor/${leaf.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.locator('.ProseMirror').click()
    await page.keyboard.type('/todo')
    await page.keyboard.press('Enter')
    await page.keyboard.type('First task')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Second task')

    await expect(page.locator('.ProseMirror')).toContainText('First task')
    await expect(page.locator('.ProseMirror')).toContainText('Second task')
    expect(pageErrors.filter((message) => /localsInner|reading 'eq'|prosemirror-view/i.test(message))).toEqual([])
  })

  test('inline database embeds render the shared database surface', async ({ page, request }) => {
    const leaf = await createLeaf(request, 'Inline database page')
    const pageErrors: string[] = []
    const consoleErrors: string[] = []

    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto(`/editor/${leaf.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.locator('.ProseMirror').click()
    await page.keyboard.type('/data')
    await expect(page.getByRole('button', { name: /Database New table database/ })).toBeVisible()
    await page.keyboard.press('Enter')

    await expect(page.getByText(/0 entries .* Inline database/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Table' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New entry' }).first()).toBeVisible()

    await page.getByRole('button', { name: 'New entry' }).first().click()
    await expect(page.locator('.ProseMirror')).toContainText('Untitled')

    expect(pageErrors.filter((message) => /localsInner|reading 'eq'|prosemirror-view/i.test(message))).toEqual([])
    expect(consoleErrors.filter((message) => /localsInner|reading 'eq'|prosemirror-view/i.test(message))).toEqual([])
  })

  test('column layouts insert and persist through reload', async ({ page, request }) => {
    const leaf = await createLeaf(request, uniqueTitle('Column layout page'))

    await page.goto(`/editor/${leaf.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.locator('.ProseMirror').click()
    await page.keyboard.type('/2')
    await expect(page.getByText('2 columns')).toBeVisible()
    await page.keyboard.press('Enter')

    await expect(page.getByText('Two-column layout')).toBeVisible()
    const columns = page.locator('.leaf-column-editor .ProseMirror')
    await columns.nth(0).click()
    await page.keyboard.type('Left column content')
    await columns.nth(1).click()
    await page.keyboard.type('Right column content')
    await page.getByText('Two-column layout').click()
    await expect(page.getByText('Synced')).toBeVisible()

    await page.reload()
    await expect(page.getByText('Two-column layout')).toBeVisible()
    await expect(page.locator('.leaf-column-editor .ProseMirror').nth(0)).toContainText('Left column content')
    await expect(page.locator('.leaf-column-editor .ProseMirror').nth(1)).toContainText('Right column content')
  })

  test('structured wikilinks render in the editor and graph view', async ({ page, request }) => {
    const token = Math.random().toString(36).slice(2, 8)
    const targetTitle = `GraphTarget-${token}`
    const sourceTitle = `GraphSource-${token}`
    const target = await createLeaf(request, targetTitle)
    const source = await createLeaf(request, sourceTitle)

    await patchLeafContent(request, source.id, {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See ' },
            {
              type: 'wikilink',
              attrs: {
                id: target.id,
                label: targetTitle,
                path: target.path,
              },
            },
          ],
        },
      ],
    })

    await page.goto(`/editor/${source.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.ProseMirror')).toContainText(`[[${targetTitle}]]`)

    await page.goto('/graph', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder('Filter by page title or path…').fill('Graph')
    await expect(page.getByRole('main').getByText(targetTitle, { exact: true })).toBeVisible()
    await expect(page.getByRole('main').getByText(sourceTitle, { exact: true })).toBeVisible()
  })

  test('row page shows full breadcrumb chain', async ({ page, request }) => {
    const parentTitle = uniqueTitle('Parent page')
    const databaseTitle = uniqueTitle('Nested database')
    const parentPage = await createLeaf(request, parentTitle)
    const database = await createDatabase(request, databaseTitle, parentPage.id)
    const row = await createRow(request, database.id)

    await page.goto(`/editor/${row.leaf_id}`)

    await expect(page.getByRole('navigation').getByRole('link', { name: parentTitle })).toBeVisible()
    await expect(page.getByRole('navigation').getByRole('link', { name: databaseTitle })).toBeVisible()
  })

  test('offline save flushes on reconnect', async ({ page, request, context }) => {
    const leaf = await createLeaf(request, uniqueTitle('Offline page'))

    await page.goto(`/editor/${leaf.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.locator('.ProseMirror').click()
    await context.setOffline(true)
    await page.keyboard.type('Offline draft content')
    await expect(page.getByTestId('status-save-label')).toContainText('Offline')

    await context.setOffline(false)
    await expect(page.getByText('Synced')).toBeVisible()

    await page.reload()
    await expect(page.locator('.ProseMirror')).toContainText('Offline draft content')
  })

  test('slow route transitions show the loading overlay', async ({ page, request }) => {
    const slowTitle = uniqueTitle('Slow loading page')
    const leaf = await createLeaf(request, slowTitle)

    await page.route(`**/leaves/${leaf.id}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.continue()
    })

    await page.goto('/')
    await page.getByRole('link', { name: slowTitle }).first().click()
    await expect(page.getByText('Loading…')).toBeVisible()
  })
})
