type FakeR2Object = {
  body: ArrayBuffer
  httpMetadata?: { contentType?: string }
}

export function fakeR2Bucket() {
  const store = new Map<string, FakeR2Object>()

  return {
    store,
    async put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream | Blob, options?: { httpMetadata?: { contentType?: string } }) {
      let buffer: ArrayBuffer
      if (value instanceof ArrayBuffer) {
        buffer = value
      } else if (ArrayBuffer.isView(value)) {
        buffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer
      } else if (value instanceof Blob) {
        buffer = await value.arrayBuffer()
      } else {
        const chunks: Uint8Array[] = []
        const reader = (value as ReadableStream<Uint8Array>).getReader()
        for (;;) {
          const { done, value: chunk } = await reader.read()
          if (done) break
          chunks.push(chunk)
        }
        const total = chunks.reduce((sum, c) => sum + c.byteLength, 0)
        const merged = new Uint8Array(total)
        let offset = 0
        for (const chunk of chunks) {
          merged.set(chunk, offset)
          offset += chunk.byteLength
        }
        buffer = merged.buffer
      }
      store.set(key, { body: buffer, httpMetadata: options?.httpMetadata })
      return { key, etag: 'fake-etag' }
    },
    async get(key: string) {
      const obj = store.get(key)
      if (!obj) return null
      return {
        body: new Blob([obj.body]).stream(),
        httpMetadata: obj.httpMetadata,
        httpEtag: '"fake-etag"',
      }
    },
    async delete(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys]
      for (const key of list) store.delete(key)
    },
  }
}
