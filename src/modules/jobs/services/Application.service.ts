import { Response } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { CRUDService } from '../../../utils/baseCRUD';
import ApplicationHandler from '../handlers/Applications.handler';
import error from '../../../middleware/error';
import asyncHandler from '../../../middleware/asyncHandler';
import JobPostHandler from '../handlers/JobPostHandler';
import { eventBus } from '../../../lib/eventBus';

export default class ApplicationService extends CRUDService {
  private applicationHandler: ApplicationHandler;
  private jobPostHandler: JobPostHandler;
  constructor() {
    super(ApplicationHandler);
    this.queryKeys = [];
    this.applicationHandler = this.handler as ApplicationHandler;
    this.jobPostHandler = new JobPostHandler();
  }

  getApplicationsForJob = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Implementation for getting applications for a specific job
    try {
      const jobId = req.params.jobId;
      const pageSize = Number(req.query?.pageLimit) || 10;
      const page = Number(req.query?.pageNumber) || 1;
      const applications = await this.handler.fetchAll({
        filters: {
          job: jobId,
        },
        page,
        limit: pageSize,
      });
      res.status(200).json({ success: true, payload: applications[0].entries, metadata: { page, pageSize, total: applications[0].total } });
    } catch (err: any) {
      console.error(err);
      error(err, req, res);
    }
  });

  public applyToJob = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    // Implementation for applying to a job
    try {
      const jobId = req.params.jobId;
      // fetch the job post to ensure it exists and is open for applications
      const jobPost = await this.jobPostHandler.fetch(jobId);
      if (!jobPost) {
        return res.status(404).json({ success: false, message: 'Job post not found' });
      }
      // ensure that the job is published, not expired, and accepting applications
      if (jobPost.status !== 'published') {
        return res.status(400).json({ success: false, message: 'Job post is not published' });
      }
      if (jobPost.expiresAt && new Date() > jobPost.expiresAt) {
        return res.status(400).json({ success: false, message: 'Job post has expired' });
      }
      // ensure that the user has a professional profile linked to their account
      if (!req.user.profileRefs?.professionalProfile) {
        return res.status(400).json({ success: false, message: 'User must have a professional profile to apply' });
      }
      // create the application
      const applicationData = {
        job: jobId,
        team: jobPost.team,
        applicant: req.user.profileRefs?.professionalProfile,
        ...req.body,
      };
      const application = await this.handler.create(applicationData);
      // trigger notification for the job poster
      eventBus.publish('job.application.submitted', {
        jobId,
        applicationId: application._id,
        teamId: jobPost.team,
      });

      return res.status(201).json({ success: true, message: 'Application submitted successfully' });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });

  getMyApplications = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    // Implementation for getting the current user's applications
    try {
      const applicantId = req.user.profileRefs?.professionalProfile;
      if (!applicantId) {
        return res.status(400).json({ success: false, message: 'User must have a professional profile to view applications' });
      }
      const pageSize = Number(req.query?.pageLimit) || 10;
      const page = Number(req.query?.pageNumber) || 1;
      const applications = await this.handler.fetchAll({
        filters: {
          applicant: applicantId,
        },
        page,
        limit: pageSize,
      });
      return res.status(200).json({ success: true, payload: applications[0].entries, metadata: { page, pageSize, total: applications[0].total } });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });

  updateApplicationStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const applicationId = req.params.id;

      if (!applicationId) {
        return res.status(400).json({ success: false, message: 'Application id is required' });
      }

      const application = await this.applicationHandler.updateStatus(applicationId, req.body?.status, String(req.user._id), req.user, req.body?.note);

      await eventBus.publish('job.application.status.updated', {
        applicationId: application._id,
        jobId: application.job,
        teamId: application.team,
        applicantId: application.applicant,
        status: application.status,
        changedBy: req.user._id,
      });

      return res.status(200).json({
        success: true,
        message: 'Application status updated successfully',
        payload: application,
      });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });

  withdrawApplication = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const applicationId = req.params.id;

      if (!applicationId) {
        return res.status(400).json({ success: false, message: 'Application id is required' });
      }

      const application = await this.applicationHandler.withdraw(applicationId, req.user.profileRefs?.professionalProfile, String(req.user._id), req.body?.note);

      await eventBus.publish('job.application.withdrawn', {
        applicationId: application._id,
        jobId: application.job,
        teamId: application.team,
        applicantId: application.applicant,
        changedBy: req.user._id,
      });

      return res.status(200).json({
        success: true,
        message: 'Application withdrawn successfully',
        payload: application,
      });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });
}
