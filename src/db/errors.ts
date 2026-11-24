import { HTTPException } from "hono/http-exception";

export function fail(status: 400 | 404 | 409, message: string): never {
  throw new HTTPException(status, { message });
}
