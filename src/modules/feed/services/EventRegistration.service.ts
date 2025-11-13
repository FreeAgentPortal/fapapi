import { Request, Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import error from '../../../middleware/error';
import { CRUDService } from '../../../utils/baseCRUD';
import { EventRegistrationHandler } from '../handlers/EventRegistration.handler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { RegistrationStatus } from '../model/EventRegistration.model';

export default class EventRegistrationService extends CRUDService {
  protected handler: EventRegistrationHandler;

  constructor() {
    super(EventRegistrationHandler);
    this.handler = new EventRegistrationHandler();
  }

  /**
   * Register a user for an event
   * POST /events/:eventId/registration
   */
  public registerForEvent = asyncHandler(async (req: Request, res: Response): Promise<any> => {
    try {
      const { eventId } = req.params;
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?._id?.toString();

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const { profileType, profileId, answers } = req.body;

      if (!profileType || !profileId) {
        return res.status(400).json({ success: false, message: 'profileType and profileId are required' });
      }

      const registration = await this.handler.registerForEvent(userId, eventId, profileType, profileId, answers);

      return res.status(201).json({
        success: true,
        message: 'Successfully registered for event',
        payload: registration,
      });
    } catch (err: any) {
      console.error(err);
      return res.status(400).json({ success: false, message: err.message || 'Registration failed' });
    }
  });

  /**
   * Get user's registration for an event
   * GET /events/:eventId/registration/me
   */
  public getMyRegistration = asyncHandler(async (req: Request, res: Response): Promise<any> => {
    try {
      const { eventId } = req.params;
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?._id?.toString();

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const registration = await this.handler.getUserRegistration(userId, eventId);

      if (!registration) {
        return res.status(404).json({ success: false, message: 'Registration not found' });
      }

      return res.status(200).json({ success: true, payload: registration });
    } catch (err: any) {
      console.error(err);
      return res.status(400).json({ success: false, message: err.message || 'Failed to fetch registration' });
    }
  });

  /**
   * Cancel/withdraw user's registration
   * DELETE /events/:eventId/registration
   */
  public cancelRegistration = asyncHandler(async (req: Request, res: Response): Promise<any> => {
    try {
      const { eventId } = req.params;
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?._id?.toString();

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const registration = await this.handler.cancelRegistration(userId, eventId);

      if (!registration) {
        return res.status(404).json({ success: false, message: 'Registration not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Registration cancelled successfully',
        payload: registration,
      });
    } catch (err: any) {
      console.error(err);
      return res.status(400).json({ success: false, message: err.message || 'Failed to cancel registration' });
    }
  });

  /**
   * Get all registrations for an event (organizer only)
   * GET /events/:eventId/registration/all
   */
  public getEventRegistrations = asyncHandler(async (req: Request, res: Response): Promise<any> => {
    try {
      const { eventId } = req.params;
      const { status } = req.query;

      const registrations = await this.handler.getEventRegistrations(eventId, status as RegistrationStatus | undefined);

      return res.status(200).json({
        success: true,
        payload: registrations,
        count: registrations.length,
      });
    } catch (err: any) {
      console.error(err);
      return res.status(400).json({ success: false, message: err.message || 'Failed to fetch registrations' });
    }
  });

  /**
   * Update registration status (organizer only)
   * PUT /events/:eventId/registration/:athleteId/status
   */
  public updateRegistrationStatus = asyncHandler(async (req: Request, res: Response): Promise<any> => {
    try {
      const { athleteId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ success: false, message: 'Status is required' });
      }

      const registration = await this.handler.updateRegistrationStatus(athleteId, status);

      if (!registration) {
        return res.status(404).json({ success: false, message: 'Registration not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Registration status updated successfully',
        payload: registration,
      });
    } catch (err: any) {
      console.error(err);
      return res.status(400).json({ success: false, message: err.message || 'Failed to update registration status' });
    }
  });

  /**
   * Get registration count for an event
   * GET /events/:eventId/registration/count
   */
  public getRegistrationCount = asyncHandler(async (req: Request, res: Response): Promise<any> => {
    try {
      const { eventId } = req.params;
      const { status } = req.query;

      const count = await this.handler.getRegistrationCount(eventId, status as RegistrationStatus | undefined);

      return res.status(200).json({
        success: true,
        payload: { count, status: status || 'all' },
      });
    } catch (err: any) {
      console.error(err);
      return res.status(400).json({ success: false, message: err.message || 'Failed to get registration count' });
    }
  });
}
