import { expect, test, type APIRequestContext } from '@playwright/test'

const apiBaseURL = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000'

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

test.describe('Leaf workspace', () => {
  test.skip(process.env.PLAYWRIGHT_E2E !== '1', 'Set PLAYWRIGHT_E2E=1 to run against a live app')

  test('create/open page, type, reload, and persist content', async ({ page, request }) => {
    const leaf = await createLeaf(request, 'E2E persisted page')

    await page.goto(`/editor/${leaf.id}`)
    await page.locator('input[placeholder="Untitled"]').fill('E2E persisted page')
    await page.locator('.ProseMirror').click()
    await page.keyboard.type('This text should persist after reload.')
    await expect(page.getByText('Synced')).toBeVisible()

    await page.reload()
    await expect(page.locator('.ProseMirror')).toContainText('This text should persist after reload.')
  })

  test('row page shows full breadcrumb chain', async ({ page, request }) => {
    const parentPage = await createLeaf(request, 'Parent page')
    const database = await createDatabase(request, 'Nested database', parentPage.id)
    const row = await createRow(request, database.id)

    await page.goto(`/editor/${row.leaf_id}`)

    await expect(page.getByRole('link', { name: 'Parent page' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Nested database' })).toBeVisible()
  })

  test('offline save flushes on reconnect', async ({ page, request, context }) => {
    const leaf = await createLeaf(request, 'Offline page')

    await page.goto(`/editor/${leaf.id}`)
    await context.setOffline(true)
    await page.locator('.ProseMirror').click()
    await page.keyboard.type('Offline draft content')
    await expect(page.getByText('Saved locally')).toBeVisible()

    await context.setOffline(false)
    await expect(page.getByText('Synced')).toBeVisible()

    await page.reload()
    await expect(page.locator('.ProseMirror')).toContainText('Offline draft content')
  })

  test('slow route transitions show the loading overlay', async ({ page, request }) => {
    const leaf = await createLeaf(request, 'Slow loading page')

    await page.route(`**/leaves/${leaf.id}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.continue()
    })

    await page.goto('/')
    await page.getByText('Slow loading page').click()
    await expect(page.getByText('Loading…')).toBeVisible()
  })
})
