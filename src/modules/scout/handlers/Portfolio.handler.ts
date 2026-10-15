import { Response } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { PortfolioService } from '../services/Portfolio.service';
import { PortfolioReviewService } from '../services/PortfolioReview.service';
import { actorId, pagination } from '../utils/portfolioInput';

export class PortfolioHandler {
  private portfolios = new PortfolioService();
  private reviews = new PortfolioReviewService();
  private handle(work: (req: AuthenticatedRequest, userId: string) => Promise<unknown>) {
    return asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      req.body ??= {};
      res.setHeader('Cache-Control', 'private, no-store');
      const payload = await work(req, actorId(req.user?._id));
      return res.json({ success: true, payload });
    });
  }
  draft = this.handle((req, user) => { const p = pagination(req.query); return this.portfolios.draft(user, p.page, p.limit); });
  edit = this.handle((req, user) => this.portfolios.edit(user, req.body));
  addItem = this.handle((req, user) => this.portfolios.saveItem(user, req.body));
  replaceItem = this.handle((req, user) => this.portfolios.saveItem(user, req.body, req.params.itemId));
  removeItem = this.handle((req, user) => this.portfolios.removeItem(user, req.params.itemId, req.body.revision));
  submit = this.handle((req, user) => this.portfolios.submit(user, req.body.revision));
  withdraw = this.handle((_req, user) => this.portfolios.withdraw(user));
  history = this.handle((req, user) => { const p = pagination(req.query); return this.portfolios.history(user, p.page, p.limit); });
  submission = this.handle((req, user) => { const p = pagination(req.query); return this.portfolios.submitted(user, req.params.submissionId, p.page, p.limit); });
  submittedItem = this.handle((req, user) => this.portfolios.submittedItem(user, req.params.submissionId, req.params.itemId));
  readItemFeedback = this.handle((req, user) => this.reviews.readItemFeedback(user, req.params.reviewId, req.params.itemId));
  feedback = this.handle((req, user) => { const p = pagination(req.query); return this.reviews.feedback(user, req.params.submissionId, p.page, p.limit); });
  start = this.handle((req, user) => this.reviews.start(user, req.params.submissionId));
  mine = this.handle((req, user) => { const p = pagination(req.query); return this.reviews.mine(user, String(req.query.state ?? 'in_progress'), p.page, p.limit); });
  review = this.handle((req, user) => { const p = pagination(req.query); return this.reviews.detail(user, req.params.reviewId, p.page, p.limit); });
  saveReview = this.handle((req, user) => this.reviews.mutate(user, req.params.reviewId, req.body, 'save'));
  itemFeedback = this.handle((req, user) => this.reviews.mutate(user, req.params.reviewId, req.body, 'item', req.params.itemId));
  decline = this.handle((req, user) => this.reviews.mutate(user, req.params.reviewId, req.body, 'decline'));
  report = this.handle((req, user) => this.reviews.mutate(user, req.params.reviewId, req.body, 'report'));
}
