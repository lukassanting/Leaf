#!/usr/bin/env node
/**
 * Optional: re-download campaign fonts (Cinzel, Cinzel Decorative, Crimson Pro)
 * from Google Fonts into public/fonts/ when updating versions.
 * The repo vendors those .woff2 files so installs work offline; run `npm run fonts` only when refreshing.
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const DEST = path.join(__dirname, '..', 'public', 'fonts')

const FONTS = [
  {
    url: 'https://fonts.gstatic.com/s/cinzel/v26/8vIJ7ww63mVu7gt79mT7.woff2',
    file: 'cinzel.woff2',
  },
  {
    url: 'https://fonts.gstatic.com/s/cinzeldecorative/v19/daaCSScvJGqLYhG8nNt8KPPswUAPni7TTMw.woff2',
    file: 'cinzel-decorative-400.woff2',
  },
  {
    url: 'https://fonts.gstatic.com/s/cinzeldecorative/v19/daaHSScvJGqLYhG8nNt8KPPswUAPniZoadlESTE.woff2',
    file: 'cinzel-decorative-700.woff2',
  },
  {
    url: 'https://fonts.gstatic.com/s/crimsonpro/v28/q5uDsoa5M_tv7IihmnkabARboYE.woff2',
    file: 'crimson-pro-normal.woff2',
  },
  {
    url: 'https://fonts.gstatic.com/s/crimsonpro/v28/q5uBsoa5M_tv7IihmnkabARekYNwDQ.woff2',
    file: 'crimson-pro-italic.woff2',
  },
]

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        fs.unlinkSync(dest)
        download(res.headers.location, dest).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        file.close()
        fs.unlinkSync(dest)
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', (err) => {
      fs.unlink(dest, () => {})
      reject(err)
    })
  })
}

async function main() {
  fs.mkdirSync(DEST, { recursive: true })

  const missing = FONTS.filter(({ file }) => !fs.existsSync(path.join(DEST, file)))
  if (missing.length === 0) {
    console.log('  fonts: all campaign fonts already present, skipping download')
    return
  }

  console.log(`  fonts: downloading ${missing.length} campaign font(s)…`)
  const results = await Promise.allSettled(
    missing.map(async ({ url, file }) => {
      await download(url, path.join(DEST, file))
      console.log(`  fonts: ✓ ${file}`)
    })
  )

  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length > 0) {
    console.warn(`  fonts: ⚠ ${failed.length} font(s) failed to download (campaign theme will use fallbacks)`)
    failed.forEach(r => console.warn('   ', r.reason?.message ?? r.reason))
  }
}

main().catch(() => {
  // Never fail the install — font download is best-effort
})
