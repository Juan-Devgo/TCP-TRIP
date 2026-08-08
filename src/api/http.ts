/** Shared response helpers so every route answers with the same shape. */

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function fail(
  status: number,
  message: string,
  details?: unknown,
): Response {
  return Response.json({ error: { message, details } }, { status });
}

/** Wraps a handler so an uncaught throw becomes a 500 instead of a dead socket. */
export function handler<T extends Request>(
  fn: (req: T) => Response | Promise<Response>,
) {
  return async (req: T): Promise<Response> => {
    try {
      return await fn(req);
    } catch (error) {
      console.error(`[api] ${req.method} ${req.url}`, error);
      return fail(500, "Internal Server Error");
    }
  };
}
