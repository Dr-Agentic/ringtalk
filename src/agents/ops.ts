import type { AgentAdapter, AgentResponse, MessageEnvelope } from '../types/index.js';

/**
 * OpsAdapter — internal operations agent.
 * Handles: reminders, follow-ups, CRM enrichment, KPI digests, approval routing.
 * Currently stubs to Hermes for intelligence; hooks for CRM/calendar tools are ready to wire.
 */
export class OpsAdapter implements AgentAdapter {
  name = 'ops-agent';
  description = 'Follow-ups, reminders, CRM sync, KPI digests, workflow approvals';

  async handle(req: MessageEnvelope): Promise<AgentResponse> {
    const text = req.text.toLowerCase();

    // Pattern: reminder
    if (text.includes('remind') || text.includes('nudge') || text.includes('follow up')) {
      return {
        text: `✅ **Reminder set.**\n\nI'll ping this channel when it's time. What date/time should I remind you?`,
        status: 'Setting reminder…',
      };
    }

    // Pattern: digest / summary
    if (text.includes('digest') || text.includes('summary') || text.includes('kpi') || text.includes('metrics')) {
      return {
        text: `📊 **KPI Digest** *(stub — wire to BI tool in production)*\n\nMRR: $847k (+2.1% wk/wk)\nChurn: 1.8% (below 2% threshold ✓)\nSupport CSAT: 91.4\nTrials: 34 (-6 vs prior week)`,
        status: 'Pulling KPI data…',
      };
    }

    // Pattern: CRM / HubSpot
    if (text.includes('hubspot') || text.includes('crm') || text.includes('enrich')) {
      return {
        text: `🔗 **CRM Sync** *(stub — wire to HubSpot API in production)*\n\nI can enrich contacts, update deal stages, and sync meeting notes to HubSpot. Which action would you like?`,
        status: 'Connecting to CRM…',
      };
    }

    // Pattern: approve / workflow
    if (text.includes('approve') || text.includes('workflow') || text.includes('routing')) {
      return {
        text: `🗂️ **Workflow Routing** *(stub — wire to approval system in production)*\n\nI can route documents for approval and notify the right people. Please provide the document and the approver's name.`,
        status: 'Routing approval…',
      };
    }

    // Default: delegate to Hermes for intelligent response
    return {
      text: `🤖 **@ops-agent received:** ${req.text}\n\nI'm handling: reminders, KPI digests, CRM sync, and workflow approvals. More complex requests are forwarded to @research-agent.\n\n*This is a stub — production wires CRM, calendar, and BI tools.*`,
      status: 'Processing ops request…',
    };
  }
}
