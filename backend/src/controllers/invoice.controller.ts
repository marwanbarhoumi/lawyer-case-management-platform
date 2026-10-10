import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth';
import * as invoiceService from '../services/invoice.service';
import { sendNoContent, sendPaginated, sendSuccess } from '../utils/response';
import { idParamSchema } from '../validators/common';
import {
  createInvoiceSchema,
  invoiceListQuerySchema,
  payInvoiceSchema,
  updateInvoiceSchema,
} from '../validators/invoice.validators';

export async function list(req: Request, res: Response) {
  const { items, meta } = await invoiceService.listInvoices(
    currentUser(req),
    invoiceListQuerySchema.parse(req.query),
  );
  sendPaginated(res, items, meta);
}

export async function get(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await invoiceService.getInvoice(currentUser(req), id));
}

export async function create(req: Request, res: Response) {
  const input = createInvoiceSchema.parse(req.body);
  sendSuccess(res, await invoiceService.createInvoice(currentUser(req), input), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updateInvoiceSchema.parse(req.body);
  sendSuccess(res, await invoiceService.updateInvoice(currentUser(req), id, input));
}

export async function pay(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = payInvoiceSchema.parse(req.body ?? {});
  sendSuccess(res, await invoiceService.payInvoice(currentUser(req), id, input));
}

export async function cancel(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await invoiceService.cancelInvoice(currentUser(req), id));
}

export async function remove(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await invoiceService.deleteInvoice(currentUser(req), id);
  sendNoContent(res);
}
