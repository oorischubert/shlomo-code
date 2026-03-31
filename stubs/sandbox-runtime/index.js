class SandboxViolationStore {
  constructor() {
    this.violations = []
    this.listeners = new Set()
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener(this.violations)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getTotalCount() {
    return this.violations.length
  }

  clear() {
    this.violations = []
    for (const listener of this.listeners) {
      listener(this.violations)
    }
  }
}

const violationStore = new SandboxViolationStore()

export const SandboxRuntimeConfigSchema = {
  parse(value) {
    return value
  },
  safeParse(value) {
    return { success: true, data: value }
  },
}

export const SandboxManager = {
  async initialize(config) {
    this.config = config ?? {}
  },
  updateConfig(config) {
    this.config = config ?? {}
  },
  checkDependencies() {
    return {
      errors: [],
      warnings: ['Sandbox runtime is stubbed in this build.'],
    }
  },
  isSupportedPlatform() {
    return false
  },
  getFsReadConfig() {
    return {
      denyOnly: [],
      allowWithinDeny: [],
    }
  },
  getFsWriteConfig() {
    return {
      allowOnly: [],
      denyWithinAllow: [],
    }
  },
  getNetworkRestrictionConfig() {
    return {
      allowedHosts: [],
      deniedHosts: [],
    }
  },
  getIgnoreViolations() {
    return undefined
  },
  getAllowUnixSockets() {
    return undefined
  },
  getAllowLocalBinding() {
    return undefined
  },
  getEnableWeakerNestedSandbox() {
    return undefined
  },
  getProxyPort() {
    return undefined
  },
  getSocksProxyPort() {
    return undefined
  },
  getLinuxHttpSocketPath() {
    return undefined
  },
  getLinuxSocksSocketPath() {
    return undefined
  },
  async waitForNetworkInitialization() {
    return false
  },
  getSandboxViolationStore() {
    return violationStore
  },
  annotateStderrWithSandboxFailures(_command, stderr) {
    return stderr
  },
  cleanupAfterCommand() {},
  async wrapWithSandbox(command) {
    return command
  },
  async reset() {
    this.config = {}
    violationStore.clear()
  },
}

export { SandboxViolationStore }
