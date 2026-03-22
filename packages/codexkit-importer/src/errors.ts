export class ImporterError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ImporterError";
    this.code = code;
  }
}
