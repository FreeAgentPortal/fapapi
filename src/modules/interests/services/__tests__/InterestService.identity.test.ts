import { Types } from 'mongoose';
import { eventBus } from '../../../../lib/eventBus';
import { InterestService } from '../InterestService';

describe('InterestService authenticated identity derivation', () => {
  afterEach(() => jest.restoreAllMocks());

  it('ignores a submitted athlete identity and uses the authenticated athlete profile', async () => {
    const athleteProfileId = new Types.ObjectId();
    const teamId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const interestId = new Types.ObjectId();
    const handler = {
      expressInterest: jest.fn().mockResolvedValue({
        interest: {
          _id: interestId,
          athleteProfile: athleteProfileId,
          teamProfile: teamId,
          initiatedByUser: userId,
        },
        quota: { limit: 3, used: 1, remaining: 2 },
      }),
    } as any;
    jest.spyOn(eventBus, 'publish').mockResolvedValue(undefined);
    const service = new InterestService(handler);
    const response = responseDouble();
    const req: any = {
      user: { _id: userId, profileRefs: { athlete: athleteProfileId.toString() } },
      body: { athleteId: new Types.ObjectId().toString(), teamId: teamId.toString(), note: 'Interested' },
      query: {},
      params: {},
    };

    await invoke(service.expressInterest, req, response.res);

    expect(handler.expressInterest).toHaveBeenCalledWith({
      athleteProfileId: athleteProfileId.toString(),
      initiatedByUserId: userId.toString(),
      teamId: teamId.toString(),
      note: 'Interested',
    });
    expect(response.status).toHaveBeenCalledWith(201);
  });
});

function responseDouble() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status } as any, status, json };
}

async function invoke(handler: any, req: any, res: any): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const originalJson = res.status().json;
    originalJson.mockImplementation(() => {
      resolve();
      return res;
    });
    handler(req, res, reject);
  });
}
