import chalk from 'chalk'
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

export const DefaultIconsFolder = 'duotone'

const iconsDir = path.resolve(__dirname, '../src/assets/icons')
const cssFilePath = path.resolve(__dirname, '../src/assets/css/icon-data.css')
const typesFilePath = path.resolve(__dirname, '../src/types/icons.ts')
const iconsCSS = path.resolve(__dirname, '../src/assets/css/icons.css')

function colorize(str: string, negative = false): string {
  const color = negative ? '#ff5d5d' : '#a6ff00'
  return chalk.hex(color)(str)
}

function watcherLog(updateType: string, filePath: string, dir: string, negative = false): void {
  let name = filePath.split(dir)[1]
  if (['/', '\\'].includes(name.charAt(0))) {
    name = name.substring(1)
  }
  log(`${updateType} ${colorize(name, negative)}`, negative)
}

function log(str: string, negative = false): void {
  console.log(colorize('»', negative), str)
}

function toLF(str: string): string {
  return str.replace(/\r\n/g, '\n')
}

function getSVGAspectRatio(svg: string): number {
  const viewBoxMatch = svg.match(/viewBox="(\d+\s\d+\s\d+\s\d+)"/)
  if (!viewBoxMatch) {
    return 1
  }

  const viewBox = viewBoxMatch[1].split(' ')
  const width = parseFloat(viewBox[2])
  const height = parseFloat(viewBox[3])

  return width / height
}

// https://bl.ocks.org/jennyknuth/222825e315d45a738ed9d6e04c7a88d0
function encodeSvg(svg: string): string {
  return svg
    .replace(/<!--.*?-->/gs, '') // Remove comments
    .replace(
      '<svg',
      ~svg.indexOf('xmlns') ? '<svg' : '<svg xmlns="http://www.w3.org/2000/svg"'
    )
    .replace(/"/g, "'")
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/{/g, '%7B')
    .replace(/}/g, '%7D')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/(\r\n|\n|\r)/g, '')
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeSvg(svg)}`
}

export interface SaIconInfo {
  folder: string
  name: string
  colored: boolean
}

interface SvgFile {
  dataUri: string
  folder: string
  aspectRatio: number
  icon: string
}

function getSvgFiles(dir: string, folderName: string): SvgFile[] {
  const files = fs.readdirSync(dir)
  let svgFiles: SvgFile[] = []

  files.forEach((file) => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      svgFiles = svgFiles.concat(getSvgFiles(filePath, file))
    } else if (file.endsWith('.svg')) {
      const svg = fs.readFileSync(filePath, 'utf8')
      svgFiles.push({
        dataUri: svgToDataUri(svg),
        folder: folderName,
        aspectRatio: getSVGAspectRatio(svg),
        icon: file.replace('.svg', ''),
      })
    }
  })

  return svgFiles
}

const fsPromises = fs.promises

/** Returns a list of all icons currently in use.
 * It also can optionally log the used or unused ones.
 * */
const getIconsInUse = async (logUnused: boolean, logUsed: boolean): Promise<string[]> => {
  const iconNames = getSvgFiles(iconsDir, '').map((f) =>
    f.folder === 'light' ? f.icon : `${f.icon}-${f.folder}`
  )
  const projectDir = path.resolve(__dirname, '../')
  const regexes = iconNames.map((name) => new RegExp(`['"]${name}['"]`, 'g'))
  const foundIcons = new Map<string, number>()
  const fileReferences = new Map<string, string[]>() // To store file references
  const allowedExtensions = new Set(['.vue', '.ts', '.js', '.css', '.scss'])
  const excludedPatterns = ['types', 'icon-data.css'] // Patterns to exclude

  const isExcludedFile = (filePath: string): boolean => {
    return excludedPatterns.some((pattern) => filePath.includes(pattern))
  }

  const searchFiles = async (dir: string): Promise<void> => {
    const files = await fsPromises.readdir(dir)
    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(dir, file)
        const stat = await fsPromises.stat(filePath)

        if (stat.isDirectory()) {
          if (
            filePath
              .split(path.sep)
              .some((part) =>
                [
                  'components',
                  'assets',
                  'layouts',
                  'models',
                  'pages',
                  'plugins',
                ].includes(part)
              )
          ) {
            await searchFiles(filePath)
          }
        } else if (
          allowedExtensions.has(path.extname(file)) &&
          !isExcludedFile(filePath)
        ) {
          const content = await fsPromises.readFile(filePath, 'utf8')
          regexes.forEach((regex, index) => {
            const name = iconNames[index]
            const matches = content.match(regex)
            if (matches) {
              foundIcons.set(name, (foundIcons.get(name) || 0) + matches.length)
              if (!fileReferences.has(name)) {
                fileReferences.set(name, [])
              }
              fileReferences.get(name)!.push(filePath)
            }
          })
        }
      })
    )
  }

  await searchFiles(projectDir)

  const foundIconNames = Array.from(foundIcons.keys())

  if (logUnused) {
    const unused = iconNames.filter((i) => !foundIcons.has(i))
    const count = unused.length
    const negative = count > 0
    log(`Found ${colorize(`${count} unused icons`, negative)}`, negative)
    iconNames.forEach((iconName) => {
      if (!foundIcons.has(iconName)) {
        log(`  - ${colorize(iconName, true)}`, true)
      }
    })
  }

  if (logUsed) {
    log(`Found ${colorize(`${foundIconNames.length} icons in use`)}`)
    foundIconNames.forEach((iconName) => {
      let l = `  - ${iconName} (${colorize(String(foundIcons.get(iconName)))})`
      l += ` ${fileReferences
        .get(iconName)![0]
        .toString()
        .replace(projectDir, '')}`
      log(l)
    })
  }
  return foundIconNames
}

const autoGeneratedMessage =
  '/* This file is auto-generated by the iconsToCSS module; do not edit */\n\n'

function generateCSS(): void {
  const baseCSS = fs.readFileSync(iconsCSS, 'utf8')

  let topCSS = `${autoGeneratedMessage}${baseCSS}\n:root{`
  let bottomCSS = '\n}'
  let topTypes = `${autoGeneratedMessage}export type IconName =`
  let bottomTypes = '\n\nexport const IconsFolder = ['

  let iconCount = 0
  const folders: string[] = []
  const files = getSvgFiles(iconsDir, '')

  if (files.length === 0) {
    // No SVGs yet — write valid placeholder types so vue-tsc passes
    fs.mkdirSync(path.dirname(cssFilePath), { recursive: true })
    fs.mkdirSync(path.dirname(typesFilePath), { recursive: true })
    fs.writeFileSync(cssFilePath, toLF(`${topCSS}${bottomCSS}`))
    fs.writeFileSync(typesFilePath, toLF(`${autoGeneratedMessage}export type IconName = string\n`))
    log(`Updated icon data for ${colorize('0 icons')} (no SVGs found)`)
    return
  }

  files.forEach((f) => {
    const type = f.folder === DefaultIconsFolder ? f.icon : `${f.icon}-${f.folder}`
    topTypes += `\n  | '${type}'`
    if (!folders.includes(f.folder)) {
      folders.push(f.folder)
      bottomTypes += `\n  '${f.folder}',`
    }

    const icon = `i-${f.icon}-${f.folder}`
    const width = `${f.aspectRatio}em`
    const cssVar = `--${icon}`
    topCSS += `\n  ${cssVar}: url("${f.dataUri}");`

    let css = `\n.${icon}:after {`
    css += `\n  width: ${width};  `
    css += `\n  ${
      f.folder === 'colored' ? 'background' : 'mask'
    }: var(${cssVar}) no-repeat;  `

    css += '\n}'
    bottomCSS += css
    iconCount += 1
  })

  fs.mkdirSync(path.dirname(cssFilePath), { recursive: true })
  fs.mkdirSync(path.dirname(typesFilePath), { recursive: true })
  fs.writeFileSync(cssFilePath, toLF(`${topCSS}${bottomCSS}`))
  fs.writeFileSync(typesFilePath, toLF(`${topTypes}${bottomTypes}\n]\n`))
  log(`Updated icon data for ${colorize(`${iconCount} used icons`)}`)
}

export default function iconsPlugin(): Plugin {
  let timeout: ReturnType<typeof setTimeout>

  function debounceGenerate() {
    clearTimeout(timeout)
    timeout = setTimeout(() => generateCSS(), 100)
  }

  return {
    name: 'vite-plugin-icons',
    buildStart() {
      generateCSS()
      if (process.env.NODE_ENV === 'production') {
        getIconsInUse(true, false)
      }
    },
    configureServer(server) {
      server.watcher.add(iconsDir)
      server.watcher.on('add', (filePath) => {
        if (!filePath.startsWith(iconsDir)) return
        watcherLog('Added', filePath, iconsDir)
        debounceGenerate()
      })
      server.watcher.on('change', (filePath) => {
        if (!filePath.startsWith(iconsDir)) return
        watcherLog('Modified', filePath, iconsDir)
        debounceGenerate()
      })
      server.watcher.on('unlink', (filePath) => {
        if (!filePath.startsWith(iconsDir)) return
        watcherLog('Removed', filePath, iconsDir, true)
        debounceGenerate()
      })
    },
  }
}
