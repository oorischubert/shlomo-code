import { chmodSync, mkdtempSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'

const compile = process.argv.includes('--compile')
const nameArgIndex = process.argv.indexOf('--name')
const outputName =
  nameArgIndex !== -1 && process.argv[nameArgIndex + 1]
    ? process.argv[nameArgIndex + 1]
    : 'shlomo'
const outputPath = compile ? `dist/${outputName}` : `dist/${outputName}.js`
const absoluteOutputPath = resolve(outputPath)

const macro = {
  VERSION: '0.2.0-tui',
  BUILD_TIME: new Date().toISOString(),
  PACKAGE_URL: 'shlomo-code',
  NATIVE_PACKAGE_URL: 'shlomo-code-native',
  FEEDBACK_CHANNEL: '#shlomo-code',
  ISSUES_EXPLAINER: 'open an issue in the local Shlomo Code repo',
  VERSION_CHANGELOG: '',
}

const buildFeatures = ['VOICE_MODE']

mkdirSync(dirname(outputPath), { recursive: true })

if (compile) {
  const compileCwd = mkdtempSync(`${tmpdir()}/shlomo-build-`)
  try {
    const proc = Bun.spawn(
      [
        'bun',
        'build',
        '--compile',
        '--target=bun',
        '--outfile',
        absoluteOutputPath,
        resolve('src/entrypoints/cli.tsx'),
        '--define',
        `MACRO=${JSON.stringify(macro)}`,
        '--feature',
        buildFeatures[0]!,
        '--define',
        `process.env.USER_TYPE=${JSON.stringify('external')}`,
        '--define',
        'process.env.IS_DEMO=false',
      ],
      {
        cwd: compileCwd,
        stdout: 'inherit',
        stderr: 'inherit',
      },
    )

    const exitCode = await proc.exited
    if (exitCode !== 0) {
      process.exit(exitCode)
    }
  } finally {
    rmSync(compileCwd, { recursive: true, force: true })
  }
  chmodSync(outputPath, 0o755)
} else {
  const result = await Bun.build({
    entrypoints: ['src/entrypoints/cli.tsx'],
    target: 'bun',
    format: 'esm',
    splitting: false,
    outfile: outputPath,
    define: {
      MACRO: JSON.stringify(macro),
      'process.env.USER_TYPE': JSON.stringify('external'),
      'process.env.IS_DEMO': 'false',
    },
    features: buildFeatures,
  } as any)

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log)
    }
    process.exit(1)
  }

  const entryOutput = result.outputs.find(output => output.kind === 'entry-point')
  if (!entryOutput) {
    console.error('Missing entry-point output from Bun.build()')
    process.exit(1)
  }

  await Bun.write(outputPath, entryOutput)
  const sourcemapOutput = result.outputs.find(output => output.kind === 'sourcemap')
  if (sourcemapOutput) {
    await Bun.write(`${outputPath}.map`, sourcemapOutput)
  }
}

console.log(
  `Built ${compile ? 'compiled binary' : 'bundled JS'} at ${
    outputPath
  }`,
)
