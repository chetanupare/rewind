declare module 'get-windows' {
  interface Window {
    title: string;
    url?: string;
    owner?: {
      name: string;
      processId: number;
      path: string;
    };
    bounds?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }
  function getWindows(): Promise<Window>;
  export default getWindows;
}
