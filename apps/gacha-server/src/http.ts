/** Erreur métier → enveloppe `{ ok:false, error:{ code, message, retryInMs? } }`. */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public retryInMs?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
