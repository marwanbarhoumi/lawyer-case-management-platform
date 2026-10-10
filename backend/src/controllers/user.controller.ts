import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth';
import * as userService from '../services/user.service';
import { sendPaginated, sendSuccess } from '../utils/response';
import { idParamSchema } from '../validators/common';
import {
  createUserSchema,
  updateUserSchema,
  userListQuerySchema,
  userLookupQuerySchema,
} from '../validators/user.validators';

export async function list(req: Request, res: Response) {
  const { items, meta } = await userService.listUsers(userListQuerySchema.parse(req.query));
  sendPaginated(res, items, meta);
}

export async function lookup(req: Request, res: Response) {
  const { role } = userLookupQuerySchema.parse(req.query);
  sendSuccess(res, await userService.lookupUsers(role));
}

export async function get(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await userService.getUser(id));
}

export async function create(req: Request, res: Response) {
  sendSuccess(
    res,
    await userService.createUser(currentUser(req), createUserSchema.parse(req.body)),
    201,
  );
}

export async function update(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(
    res,
    await userService.updateUser(currentUser(req), id, updateUserSchema.parse(req.body)),
  );
}
