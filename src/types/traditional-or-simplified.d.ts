declare module 'traditional-or-simplified' {
  interface Result {
    traditionalCharacters: number;
    simplifiedCharacters: number;
  }
  interface Options {
    threshold?: number;
  }
  function detect(text: string, options?: Options): Result;
  const detect: typeof detect;
  export default { detect };
}
