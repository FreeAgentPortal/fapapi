import { AthleteModel } from '../../athlete/models/AthleteModel';
import { AgentProfileModel } from '../../agent/model/AgentProfile';

export interface AgentManagementReport {
  generatedAt: string;
  summary: {
    activeAgentProfiles: number;
    registeredAthletes: number;
    agentManagedAthletes: number;
    unmanagedRegisteredAthletes: number;
    agentManagedPercentage: number;
  };
}

export class AgentManagementReportHandler {
  public async generateReport(): Promise<AgentManagementReport> {
    const registeredAthleteQuery = {
      userId: { $exists: true, $ne: null },
    };

    const [activeAgentProfiles, registeredAthletes, agentManagedAthletes] = await Promise.all([
      AgentProfileModel.countDocuments({ isActive: true }),
      AthleteModel.countDocuments(registeredAthleteQuery),
      AthleteModel.countDocuments({
        ...registeredAthleteQuery,
        'agent.profile': { $exists: true, $ne: null },
        'agent.status': 'active',
      }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        activeAgentProfiles,
        registeredAthletes,
        agentManagedAthletes,
        unmanagedRegisteredAthletes: registeredAthletes - agentManagedAthletes,
        agentManagedPercentage:
          registeredAthletes > 0
            ? Math.round((agentManagedAthletes / registeredAthletes) * 10000) / 100
            : 0,
      },
    };
  }
}
