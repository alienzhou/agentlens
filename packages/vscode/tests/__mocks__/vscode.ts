/**
 * Mock for vscode module in tests
 */

export const workspace = {
  workspaceFolders: [],
  getConfiguration: () => ({
    get: (key: string, defaultValue: unknown) => defaultValue,
  }),
};

export const window = {
  createOutputChannel: () => ({
    appendLine: () => {},
    clear: () => {},
    show: () => {},
    hide: () => {},
    dispose: () => {},
  }),
};

export const ThemeColor = class {
  constructor(public id: string) {}
};

export default {
  workspace,
  window,
  ThemeColor,
};
