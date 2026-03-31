export function unsupported() {
  throw new Error('@ant/computer-use-swift is not available in this build')
}

export default {
  tcc: {
    checkAccessibility: () => false,
    checkScreenRecording: () => false,
  },
}
