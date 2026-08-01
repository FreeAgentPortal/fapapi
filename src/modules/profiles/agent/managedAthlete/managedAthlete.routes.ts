import express from 'express';
import { ManagedAthleteHandler } from './ManagedAthlete.handler';

const router = express.Router();
const handler = new ManagedAthleteHandler();

router.get('/:athleteId/workspace', handler.getWorkspace);
router.put('/:athleteId/profile', handler.updateProfile);

router.get('/:athleteId/resume', handler.getResume);
router.post('/:athleteId/resume', handler.createResume);
router.put('/:athleteId/resume/:resumeId', handler.updateResumeVisibility);

router.post('/:athleteId/resume/qa', handler.rejectQAMutation);
router.put('/:athleteId/resume/qa/:itemId', handler.rejectQAMutation);
router.delete('/:athleteId/resume/qa/:resumeId/:itemId', handler.rejectQAMutation);

router.post('/:athleteId/resume/:section', handler.createResumeItem);
router.put('/:athleteId/resume/:section/:itemId', handler.updateResumeItem);
router.delete('/:athleteId/resume/:section/:resumeId/:itemId', handler.deleteResumeItem);

export default router;
