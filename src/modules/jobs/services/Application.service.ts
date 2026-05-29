import { Response } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { CRUDService } from '../../../utils/baseCRUD';
import ApplicationHandler from '../handlers/Applications.handler';
import ApplicationNoteHandler from '../handlers/ApplicationNote.handler';
import ApplicationProfileHandler from '../handlers/ApplicationProfile.handler';
import error from '../../../middleware/error';
import asyncHandler from '../../../middleware/asyncHandler';
import JobPostHandler from '../handlers/JobPostHandler';
import { eventBus } from '../../../lib/eventBus';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';

export default class ApplicationService extends CRUDService {
  private applicationHandler: ApplicationHandler;
  private applicationNoteHandler: ApplicationNoteHandler;
  private jobPostHandler: JobPostHandler;
  private applicationProfileHandler: ApplicationProfileHandler;

  constructor() {
    super(ApplicationHandler);
    this.queryKeys = [];
    this.applicationHandler = this.handler as ApplicationHandler;
    this.applicationNoteHandler = new ApplicationNoteHandler();
    this.jobPostHandler = new JobPostHandler();
    this.applicationProfileHandler = new ApplicationProfileHandler();
  }

  getApplicationsForJob = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const jobId = req.params.jobId;
      const pageSize = Number(req.query?.pageLimit) || 10;
      const page = Number(req.query?.pageNumber) || 1;
      const applications = await this.handler.fetchAll({
        filters: AdvFilters.filter(`job;${jobId}`),
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
    try {
      const jobId = req.params.jobId;
      const professionalProfileId = await this.applicationProfileHandler.ensureProfessionalProfile(req.user);
      const jobPost = await this.jobPostHandler.fetch(jobId);

      if (!jobPost) {
        return res.status(404).json({ success: false, message: 'Job post not found' });
      }

      if (jobPost.status !== 'published') {
        return res.status(400).json({ success: false, message: 'Job post is not published' });
      }

      if (jobPost.expiresAt && new Date() > jobPost.expiresAt) {
        return res.status(400).json({ success: false, message: 'Job post has expired' });
      }

      if (!professionalProfileId) {
        return res.status(400).json({ success: false, message: 'User must have a professional profile to apply' });
      }

      const alreadyApplied = await this.applicationHandler.hasAppliedToJob(jobId, professionalProfileId);
      if (alreadyApplied) {
        return res.status(409).json({ success: false, message: 'User has already applied to this job' });
      }

      if (req.body?.attachResume) {
        const resumeId = await this.applicationProfileHandler.findResumeId(professionalProfileId);

        if (resumeId) {
          req.body.resume = resumeId;
        }
      }

      const match = await this.applicationProfileHandler.buildApplicationMatch(jobPost, professionalProfileId);
      console.log('Built application match:', match);
      if (!match) {
        return res.status(404).json({ success: false, message: 'Professional profile not found' });
      }

      const applicationData = {
        ...req.body,
        job: jobId,
        team: jobPost.team,
        applicant: professionalProfileId,
        matchScore: match.score,
        matchReasons: match.reasons,
      };
      let application;

      try {
        application = await this.handler.create(applicationData);
      } catch (err: any) {
        if (err?.code === 11000) {
          return res.status(409).json({ success: false, message: 'User has already applied to this job' });
        }

        throw err;
      }

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

  getMyApplicationStatusCounts = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const applicantId = this.applicationProfileHandler.getProfessionalProfileId(req.user);
      if (!applicantId) {
        return res.status(400).json({ success: false, message: 'User must have a professional profile to view application metrics' });
      }

      const counts = await this.applicationHandler.getStatusCounts(applicantId);
      return res.status(200).json({ success: true, payload: counts });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });

  getMyApplications = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const applicantId = this.applicationProfileHandler.getProfessionalProfileId(req.user);
      if (!applicantId) {
        return res.status(400).json({ success: false, message: 'User must have a professional profile to view applications' });
      }

      const pageSize = Number(req.query?.pageLimit) || 10;
      const page = Number(req.query?.pageNumber) || 1;
      const applications = await this.applicationHandler.fetchAllForApplicant({
        filters: AdvFilters.filter(`applicant;${applicantId}`),
        sort: { createdAt: -1 },
        query: [],
        page,
        limit: pageSize,
      });

      return res.status(200).json({ success: true, payload: applications[0].entries, metadata: { page, pageSize, total: (applications[0] as any).total } });
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

  rejectApplication = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const applicationId = req.params.id;

      if (!applicationId) {
        return res.status(400).json({ success: false, message: 'Application id is required' });
      }

      const application = await this.applicationHandler.reject(applicationId, String(req.user._id), req.user, req.body?.rejectionMessage);

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
        message: 'Application rejected successfully',
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

      const application = await this.applicationHandler.withdraw(
        applicationId,
        this.applicationProfileHandler.getProfessionalProfileId(req.user),
        String(req.user._id),
        req.body?.note
      );

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

  addApplicationNote = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const applicationId = req.params.id;

      if (!applicationId) {
        return res.status(400).json({ success: false, message: 'Application id is required' });
      }

      const application = await this.applicationNoteHandler.addNote(applicationId, { header: req.body?.header, body: req.body?.body }, String(req.user._id), req.user);

      return res.status(201).json({ success: true, message: 'Note added successfully', payload: application });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });

  updateApplicationNote = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { id: applicationId, noteId } = req.params;

      if (!applicationId || !noteId) {
        return res.status(400).json({ success: false, message: 'Application id and note id are required' });
      }

      const application = await this.applicationNoteHandler.updateNote(applicationId, noteId, { header: req.body?.header, body: req.body?.body }, req.user);

      return res.status(200).json({ success: true, message: 'Note updated successfully', payload: application });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });

  removeApplicationNote = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { id: applicationId, noteId } = req.params;

      if (!applicationId || !noteId) {
        return res.status(400).json({ success: false, message: 'Application id and note id are required' });
      }

      const application = await this.applicationNoteHandler.removeNote(applicationId, noteId, req.user);

      return res.status(200).json({ success: true, message: 'Note removed successfully', payload: application });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });
}
