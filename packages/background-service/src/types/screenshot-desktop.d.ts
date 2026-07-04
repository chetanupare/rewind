declare module 'screenshot-desktop' {
  interface Options {
    format?: 'jpeg' | 'png';
    quality?: number;
    screen?: number;
  }
  function screenshotDesktop(options?: Options): Promise<Buffer>;
  export default screenshotDesktop;
}
