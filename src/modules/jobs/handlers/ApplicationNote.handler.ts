import { Types } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { CRUDHandler } from '../../../utils/baseCRUD';
import JobApplicationModel, { IApplicationNote, IJobApplication } from '../models/JobApplication';
import { ApplicationHandlerUtils } from '../utils/ApplicationHandlerUtils';

type ApplicationActorContext = {
  role?: string[];
  profileRefs?: Record<string, string | null>;
};

export default class ApplicationNoteHandler extends CRUDHandler<IJobApplication> {
  constructor() {
    super(JobApplicationModel);
  }

  async addNote(
    applicationId: string,
    payload: { header: unknown; body: unknown },
    authorUserId: string,
    actor: ApplicationActorContext | null | undefined
  ): Promise<IJobApplication> {
    const application = await ApplicationHandlerUtils.requireApplication(this.Schema, applicationId);

    if (!ApplicationHandlerUtils.canManageApplication(actor, application.team)) {
      throw new ErrorUtil('Forbidden: you do not have permission to add notes to this application', 403);
    }

    if (typeof payload.header !== 'string' || !payload.header.trim()) {
      throw new ErrorUtil('Note header is required', 400);
    }

    if (typeof payload.body !== 'string' || !payload.body.trim()) {
      throw new ErrorUtil('Note body is required', 400);
    }

    if (!Types.ObjectId.isValid(authorUserId)) {
      throw new ErrorUtil('Invalid user context for note authorship', 400);
    }

    application.notes.push({
      _id: new Types.ObjectId(),
      header: payload.header.trim(),
      body: payload.body.trim(),
      author: new Types.ObjectId(authorUserId),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as IApplicationNote);

    await application.save();
    return application;
  }

  async updateNote(
    applicationId: string,
    noteId: string,
    payload: { header?: unknown; body?: unknown },
    actor: ApplicationActorContext | null | undefined
  ): Promise<IJobApplication> {
    const application = await ApplicationHandlerUtils.requireApplication(this.Schema, applicationId);

    if (!ApplicationHandlerUtils.canManageApplication(actor, application.team)) {
      throw new ErrorUtil('Forbidden: you do not have permission to update notes on this application', 403);
    }

    const note = application.notes.find((n) => String(n._id) === noteId);

    if (!note) {
      throw new ErrorUtil('Note not found', 404);
    }

    if (typeof payload.header === 'string' && payload.header.trim()) {
      note.header = payload.header.trim();
    }

    if (typeof payload.body === 'string' && payload.body.trim()) {
      note.body = payload.body.trim();
    }

    note.updatedAt = new Date();

    await application.save();
    return application;
  }

  async removeNote(applicationId: string, noteId: string, actor: ApplicationActorContext | null | undefined): Promise<IJobApplication> {
    const application = await ApplicationHandlerUtils.requireApplication(this.Schema, applicationId);

    if (!ApplicationHandlerUtils.canManageApplication(actor, application.team)) {
      throw new ErrorUtil('Forbidden: you do not have permission to remove notes from this application', 403);
    }

    const noteIndex = application.notes.findIndex((n) => String(n._id) === noteId);

    if (noteIndex === -1) {
      throw new ErrorUtil('Note not found', 404);
    }

    application.notes.splice(noteIndex, 1);

    await application.save();
    return application;
  }
}
