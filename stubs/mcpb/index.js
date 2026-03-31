export const McpbManifestSchema = {
  safeParse(value) {
    if (value && typeof value === 'object') {
      return { success: true, data: value }
    }
    return {
      success: false,
      error: {
        flatten() {
          return { fieldErrors: {}, formErrors: ['Expected manifest object'] }
        },
      },
    }
  },
}

export async function getMcpConfigForManifest() {
  return {
    type: 'stdio',
    command: 'true',
    args: [],
  }
}
