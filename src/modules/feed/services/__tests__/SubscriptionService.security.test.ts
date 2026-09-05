import { Types } from 'mongoose';
import subscriptionRouter from '../../routes/subscription';
import SubscriptionService from '../SubscriptionService';

describe('legacy subscription toggle security', () => {
  it('mounts authentication directly on the legacy toggle route', () => {
    const routeLayer = (subscriptionRouter as any).stack.find((layer: any) => layer.route?.path === '/toggle');

    expect(routeLayer).toBeDefined();
    expect(routeLayer.route.stack).toHaveLength(2);
  });

  it('derives the subscriber profile ID from the authenticated user', async () => {
    const authenticatedAthleteId = new Types.ObjectId().toString();
    const spoofedAthleteId = new Types.ObjectId().toString();
    const teamId = new Types.ObjectId().toString();
    const toggle = jest.fn().mockResolvedValue({ subscribed: true });
    const service = new SubscriptionService();
    (service as any).handler = { toggle };
    const response = responseDouble();
    const req: any = {
      user: { profileRefs: { athlete: authenticatedAthleteId } },
      body: {
        subscriber: { role: 'athlete', profileId: spoofedAthleteId },
        target: { role: 'team', profileId: teamId },
      },
    };

    await invoke(service.subscribe, req, response.res);

    expect(toggle).toHaveBeenCalledWith(
      { role: 'athlete', profileId: authenticatedAthleteId },
      { role: 'team', profileId: teamId }
    );
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
    res.status().json.mockImplementation(() => {
      resolve();
      return res;
    });
    handler(req, res, reject);
  });
}
