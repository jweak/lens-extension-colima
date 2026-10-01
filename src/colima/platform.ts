/** Colima runs on macOS and Linux; on Windows there is nothing for this extension to offer. */
export const isWindows = () => /Windows/i.test(globalThis.navigator?.userAgent ?? "");
