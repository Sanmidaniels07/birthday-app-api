import type { Response } from 'express';

export interface Meta {
  cursor?: string | null;
  hasMore?: boolean;
  total?: number;
}

export function ok<T>(res: Response, data: T, meta?: Meta, status = 200) {
  return res.status(status).json(meta ? { data, meta } : { data });
}

export function created<T>(res: Response, data: T) {
  return ok(res, data, undefined, 201);
}

export function noContent(res: Response) {
  return res.status(204).send();
}