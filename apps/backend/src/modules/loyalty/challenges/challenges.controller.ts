import type { RequestHandler } from "express";
import { challengesService } from "./challenges.service.js";
import { readChallengeId, readChallengeInput } from "./challenges.validation.js";

export const listChallenges: RequestHandler = async (req, res) => res.json(await challengesService.listMerchant(res.locals.user.id, req.query));
export const createChallenge: RequestHandler = async (req, res) => res.status(201).json({ challenge: await challengesService.create(res.locals.user.id, readChallengeInput(req.body) as never) });
export const updateChallenge: RequestHandler = async (req, res) => res.json(await challengesService.update(res.locals.user.id, readChallengeId(req.params.challengeId), readChallengeInput(req.body, true) as never));
export const activateChallenge: RequestHandler = async (req, res) => res.json(await challengesService.activate(res.locals.user.id, readChallengeId(req.params.challengeId)));
export const pauseChallenge: RequestHandler = async (req, res) => res.json(await challengesService.setStatus(res.locals.user.id, readChallengeId(req.params.challengeId), "PAUSED"));
export const archiveChallenge: RequestHandler = async (req, res) => res.json(await challengesService.setStatus(res.locals.user.id, readChallengeId(req.params.challengeId), "ARCHIVED"));
export const getChallenge: RequestHandler = async (req, res) => res.json(await challengesService.detail(res.locals.user.id, readChallengeId(req.params.challengeId), req.query));
export const deleteChallenge: RequestHandler = async (req, res) => res.json(await challengesService.delete(res.locals.user.id, readChallengeId(req.params.challengeId)));
export const publicChallenges: RequestHandler = async (req, res) => res.json(await challengesService.listPublic(String(req.params.slug)));
export const publicChallenge: RequestHandler = async (req, res) => res.json(await challengesService.getPublic(String(req.params.slug), readChallengeId(req.params.challengeId)));
export const memberChallenges: RequestHandler = async (req, res) => res.json(await challengesService.listMember(res.locals.user.id, String(req.params.slug)));
export const memberChallenge: RequestHandler = async (req, res) => res.json(await challengesService.getMember(res.locals.user.id, String(req.params.slug), readChallengeId(req.params.challengeId)));
export const memberCheckIn: RequestHandler = async (req, res) => res.json(await challengesService.checkIn(res.locals.user.id, String(req.params.slug)));
