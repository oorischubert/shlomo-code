import { Buffer } from 'buffer'

function createSharpInstance(buffer = Buffer.alloc(0), metadata = {}) {
  const state = {
    buffer,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format ?? 'png',
  }

  return {
    async metadata() {
      return {
        width: state.width,
        height: state.height,
        format: state.format,
      }
    },
    resize(width, height) {
      state.width = width
      state.height = height
      return this
    },
    jpeg() {
      state.format = 'jpeg'
      return this
    },
    png() {
      state.format = 'png'
      return this
    },
    webp() {
      state.format = 'webp'
      return this
    },
    async toBuffer() {
      return state.buffer
    },
  }
}

export default function sharp(input) {
  if (input && typeof input === 'object' && 'create' in input) {
    const create = input.create
    return createSharpInstance(Buffer.alloc(0), {
      width: create.width,
      height: create.height,
      format: 'png',
    })
  }

  return createSharpInstance(Buffer.isBuffer(input) ? input : Buffer.alloc(0))
}
