import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth';
import * as caseService from '../services/case.service';
import { sendNoContent, sendPaginated, sendSuccess } from '../utils/response';
import {
  caseListQuerySchema,
  createCaseSchema,
  updateCaseSchema,
} from '../validators/case.validators';
import { idParamSchema } from '../validators/common';

export async function list(req: Request, res: Response) {
  const { items, meta } = await caseService.listCases(
    currentUser(req),
    caseListQuerySchema.parse(req.query),
  );
  sendPaginated(res, items, meta);
}

export async function get(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await caseService.getCase(currentUser(req), id));
}

export async function timeline(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await caseService.getCaseTimeline(currentUser(req), id));
}

export async function create(req: Request, res: Response) {
  const input = createCaseSchema.parse(req.body);
  sendSuccess(res, await caseService.createCase(currentUser(req), input), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updateCaseSchema.parse(req.body);
  sendSuccess(res, await caseService.updateCase(currentUser(req), id, input));
}

export async function close(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await caseService.closeCase(currentUser(req), id));
}

export async function reopen(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await caseService.reopenCase(currentUser(req), id));
}

export async function remove(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await caseService.deleteCase(currentUser(req), id);
  sendNoContent(res);
}
