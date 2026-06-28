import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { gristGet, gristPut } from '../clients/grist.js';
import type { GristRecordsResponse, LearningContextFields } from '../types.js';

export function registerContextTools(server: McpServer) {
  server.tool(
    'get_learning_context',
    'Get the current German learning context including target level, topic, and professional environment.',
    {},
    async () => {
      const data = await gristGet<GristRecordsResponse<LearningContextFields>>(
        '/tables/LearningContext/records',
      );
      if (!data.records.length) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  targetLevel: 'B1',
                  currentTopic: 'General Software Engineering',
                  professionalEnvironment: 'Software Engineer',
                },
                null,
                2,
              ),
            },
          ],
        };
      }
      const record = data.records[0].fields;
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(record, null, 2) }],
      };
    },
  );

  server.tool(
    'update_learning_context',
    'Update the German learning context target level and current topic.',
    {
      targetLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
      currentTopic: z.string().optional(),
      professionalEnvironment: z.string().optional(),
    },
    async ({ targetLevel, currentTopic, professionalEnvironment }) => {
      // Fetch the first record to get its ID if it exists
      const data = await gristGet<GristRecordsResponse<LearningContextFields>>(
        '/tables/LearningContext/records',
      );
      const rowId = data.records.length ? data.records[0].id : 1;

      const fields: Partial<LearningContextFields> = {
        updatedAt: new Date().toISOString(),
      };
      if (targetLevel) fields.targetLevel = targetLevel;
      if (currentTopic) fields.currentTopic = currentTopic;
      if (professionalEnvironment) fields.professionalEnvironment = professionalEnvironment;

      await gristPut('/tables/LearningContext/records', {
        records: [
          {
            require: { id: rowId },
            fields,
          },
        ],
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Learning context updated successfully.`,
          },
        ],
      };
    },
  );
}
