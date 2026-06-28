import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { gristGet, gristPost, gristPatch, gristFilter } from '../clients/grist.js';
import type { GristRecordsResponse, VocabularyFields, VocabularyReviewFields } from '../types.js';

export function registerVocabularyTools(server: McpServer) {
  server.tool(
    'list_vocabulary',
    'List vocabulary words in Grist. Can be filtered by level or type (new, revised, permanent, complicated).',
    {
      level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
      type: z.enum(['new', 'revised', 'permanent', 'complicated']).optional(),
    },
    async ({ level, type }) => {
      const filters: Record<string, any[]> = {};
      if (level) filters.level = [level];
      if (type) filters.type = [type];

      const query = Object.keys(filters).length ? gristFilter(filters) : '';
      const data = await gristGet<GristRecordsResponse<VocabularyFields>>(
        `/tables/Vocabulary/records${query}`,
      );

      const items = data.records.map((r) => ({
        id: r.id,
        ...r.fields,
      }));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }],
      };
    },
  );

  server.tool(
    'add_vocabulary',
    'Add a new vocabulary word or phrase to the library.',
    {
      word: z.string().describe('German word or phrase'),
      meanings: z.string().describe('English translations/meanings'),
      level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
      type: z.enum(['new', 'revised', 'permanent', 'complicated']).default('new'),
      grammar: z.string().describe('Article, plural form (nouns), aux + past participle (verbs), etc.'),
      dailyUse: z.string().describe('Example sentence in daily life'),
      professionalUse: z.string().describe('Example sentence in professional environment'),
      tips: z.string().describe('Grammatical cases, prepositions, tips'),
      caution: z.string().describe('Pitfalls, false friends, common errors'),
      context: z.string().optional().describe('Sentence context where this word was captured'),
      isProcessed: z.boolean().optional().describe('True if this word is fully filled out, false if waiting in queue'),
    },
    async (fields) => {
      const result = await gristPost('/tables/Vocabulary/records', {
        records: [
          {
            fields: {
              ...fields,
              isProcessed: fields.isProcessed ?? (!!fields.meanings),
              correctCount: 0,
              updatedAt: new Date().toISOString(),
            },
          },
        ],
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Vocabulary '${fields.word}' added with ID ${result.records[0].id}.`,
          },
        ],
      };
    },
  );

  server.tool(
    'update_vocabulary',
    'Update details of an existing vocabulary word (e.g. increment correctCount, change type).',
    {
      id: z.number().describe('Grist row ID of the vocabulary item'),
      type: z.enum(['new', 'revised', 'permanent', 'complicated']).optional(),
      correctCount: z.number().optional(),
      meanings: z.string().optional(),
      grammar: z.string().optional(),
      dailyUse: z.string().optional(),
      professionalUse: z.string().optional(),
      tips: z.string().optional(),
      caution: z.string().optional(),
      context: z.string().optional(),
      isProcessed: z.boolean().optional(),
    },
    async ({ id, ...fields }) => {
      const patchFields: Partial<VocabularyFields> = {
        ...fields,
        updatedAt: new Date().toISOString(),
      };

      await gristPatch('/tables/Vocabulary/records', {
        records: [{ id, fields: patchFields }],
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Vocabulary ID ${id} updated successfully.`,
          },
        ],
      };
    },
  );

  server.tool(
    'list_reviews',
    'List vocabulary reviews, optionally filtered by status (pending_correction, corrected, failed).',
    {
      status: z.enum(['pending_correction', 'corrected', 'failed']).optional(),
    },
    async ({ status }) => {
      const filters: Record<string, any[]> = {};
      if (status) filters.status = [status];

      const query = Object.keys(filters).length ? gristFilter(filters) : '';
      const data = await gristGet<GristRecordsResponse<VocabularyReviewFields>>(
        `/tables/VocabularyReviews/records${query}`,
      );

      const items = data.records.map((r) => ({
        id: r.id,
        ...r.fields,
      }));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }],
      };
    },
  );

  server.tool(
    'update_review',
    'Provide AI grading, corrected sentence, and feedback for a review attempt.',
    {
      id: z.number().describe('Grist row ID of the review record'),
      correctedSentence: z.string().describe('The corrected German sentence'),
      correctionFeedback: z.string().describe('Feedback on grammar, spelling, word choice'),
      status: z.enum(['corrected', 'failed']).describe('Whether the user sentence was correct or failed'),
    },
    async ({ id, correctedSentence, correctionFeedback, status }) => {
      await gristPatch('/tables/VocabularyReviews/records', {
        records: [
          {
            id,
            fields: {
              correctedSentence,
              correctionFeedback,
              status,
              reviewedAt: new Date().toISOString(),
            },
          },
        ],
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Review ID ${id} marked as '${status}' and updated with corrections.`,
          },
        ],
      };
    },
  );
}
