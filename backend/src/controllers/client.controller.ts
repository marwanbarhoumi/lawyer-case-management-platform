import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth';
import * as clientService from '../services/client.service';
import { sendNoContent, sendPaginated, sendSuccess } from '../utils/response';
import {
  clientListQuerySchema,
  createClientSchema,
  updateClientSchema,
} from '../validators/client.validators';
import { booleanQuery, idParamSchema } from '../validators/common';

export async function list(req: Request, res: Response) {
  const { items, meta } = await clientService.listClients(
    currentUser(req),
    clientListQuerySchema.parse(req.query),
  );
  sendPaginated(res, items, meta);
}

export async function get(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await clientService.getClient(currentUser(req), id));
}

export async function timeline(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await clientService.getClientTimeline(currentUser(req), id));
}

export async function create(req: Request, res: Response) {
  const input = createClientSchema.parse(req.body);
  sendSuccess(res, await clientService.createClient(currentUser(req), input), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updateClientSchema.parse(req.body);
  sendSuccess(res, await clientService.updateClient(currentUser(req), id, input));
}

/** Archives by default; `?permanent=true` deletes (admin only, no related records). */
export async function remove(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { permanent } = z.object({ permanent: booleanQuery }).parse(req.query);
  if (permanent) {
    await clientService.deleteClientPermanently(currentUser(req), id);
    sendNoContent(res);
    return;
  }
  sendSuccess(res, await clientService.archiveClient(currentUser(req), id));
}

export async function restore(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await clientService.restoreClient(currentUser(req), id));
}
