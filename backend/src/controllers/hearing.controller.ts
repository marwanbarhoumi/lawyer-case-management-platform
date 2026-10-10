import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth';
import * as hearingService from '../services/hearing.service';
import { sendNoContent, sendPaginated, sendSuccess } from '../utils/response';
import { idParamSchema } from '../validators/common';
import {
  completeHearingSchema,
  createHearingSchema,
  hearingListQuerySchema,
  updateHearingSchema,
} from '../validators/hearing.validators';

export async function list(req: Request, res: Response) {
  const { items, meta } = await hearingService.listHearings(
    currentUser(req),
    hearingListQuerySchema.parse(req.query),
  );
  sendPaginated(res, items, meta);
}

export async function get(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await hearingService.getHearing(currentUser(req), id));
}

export async function create(req: Request, res: Response) {
  const input = createHearingSchema.parse(req.body);
  sendSuccess(res, await hearingService.createHearing(currentUser(req), input), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updateHearingSchema.parse(req.body);
  sendSuccess(res, await hearingService.updateHearing(currentUser(req), id, input));
}

export async function complete(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { notes } = completeHearingSchema.parse(req.body ?? {});
  sendSuccess(res, await hearingService.completeHearing(currentUser(req), id, notes));
}

export async function remove(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await hearingService.deleteHearing(currentUser(req), id);
  sendNoContent(res);
}
