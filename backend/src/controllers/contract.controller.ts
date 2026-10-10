import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth';
import * as contractService from '../services/contract.service';
import { sendNoContent, sendPaginated, sendSuccess } from '../utils/response';
import { idParamSchema } from '../validators/common';
import {
  contractListQuerySchema,
  createContractSchema,
  updateContractSchema,
} from '../validators/contract.validators';

export async function list(req: Request, res: Response) {
  const { items, meta } = await contractService.listContracts(
    currentUser(req),
    contractListQuerySchema.parse(req.query),
  );
  sendPaginated(res, items, meta);
}

export async function get(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await contractService.getContract(currentUser(req), id));
}

export async function create(req: Request, res: Response) {
  const input = createContractSchema.parse(req.body);
  sendSuccess(res, await contractService.createContract(currentUser(req), input), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updateContractSchema.parse(req.body);
  sendSuccess(res, await contractService.updateContract(currentUser(req), id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await contractService.deleteContract(currentUser(req), id);
  sendNoContent(res);
}
