import type { RequestHandler } from "express";
import { HttpError } from "../../lib/http-error.js";
import { paymentsService } from "./payments.service.js";

function readId(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new HttpError(400, "INVALID_INPUT");
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2_147_483_647) throw new HttpError(400, "INVALID_INPUT");
  return id;
}

export const createVnpayPayment: RequestHandler = async (request, response) => {
  const result = await paymentsService.createVnpayPayment(
    response.locals.user.id,
    readId(request.params.orderId),
    request.ip ?? "127.0.0.1",
  );
  response.status(result.orderStatus === "PAID" ? 200 : 201).json(result);
};

export const getPaymentStatus: RequestHandler = async (request, response) => {
  response.json(await paymentsService.getStatus(response.locals.user.id, readId(request.params.orderId)));
};

export const receiveVnpayIpn: RequestHandler = async (request, response) => {
  const query = new URL(request.originalUrl, "http://localhost").searchParams;
  const result = await paymentsService.processIpn(query);
  response.json({ RspCode: result.code, Message: result.message });
};

export const receiveVnpayReturn: RequestHandler = async (request, response) => {
  const query = new URL(request.originalUrl, "http://localhost").searchParams;
  response.redirect(302, await paymentsService.getReturnLocation(query));
};
