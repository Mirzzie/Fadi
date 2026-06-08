/**
 * Minimal type declaration for `word-extractor` (which ships no types). We only
 * use the default-exported extractor and the document's `getBody()`.
 */
declare module "word-extractor" {
  interface WordDocument {
    getBody(): string;
    getFootnotes(): string;
    getHeaders(): string;
  }
  export default class WordExtractor {
    extract(input: string | Buffer): Promise<WordDocument>;
  }
}
