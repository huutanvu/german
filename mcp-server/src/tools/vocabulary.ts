import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { gristGet, gristPost, gristPatch, gristFilter } from '../clients/grist.js';
import type { GristRecordsResponse, VocabularyFields, VocabularyReviewFields, VocabularyUsageFields } from '../types.js';

import { compileTokenInput } from '../utils/compiler.js';

export function registerVocabularyTools(server: McpServer) {
  server.tool(
    'list_vocabulary',
    'List vocabulary words in Grist. Can be filtered by level or type (new, revised, permanent, complicated).',
    {
      level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
      type: z.enum(['new', 'revised', 'permanent', 'complicated']).optional(),
      userId: z.string().optional().describe('Filter by user ID for multi-user support'),
    },
    async ({ level, type, userId }) => {
      const filters: Record<string, any[]> = {};
      if (level) filters.level = [level];
      if (type) filters.type = [type];
      if (userId) filters.userId = [userId];

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
      meanings_vn: z.string().optional().describe('Vietnamese translations/meanings'),
      level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
      type: z.enum(['new', 'revised', 'permanent', 'complicated']).default('new'),
      grammar: z.string().describe('Article, plural form (nouns), aux + past participle (verbs), etc.'),
      grammar_vn: z.string().optional().describe('Grammatical notes in Vietnamese'),
      dailyUse: z.string().describe('Example sentence in daily life'),
      dailyUse_vn: z.string().optional().describe('Daily example sentence in Vietnamese'),
      professionalUse: z.string().describe('Example sentence in professional environment'),
      professionalUse_vn: z.string().optional().describe('Professional example sentence in Vietnamese'),
      tips: z.string().describe('Grammatical cases, prepositions, tips'),
      tips_vn: z.string().optional().describe('Tips in Vietnamese'),
      caution: z.string().describe('Pitfalls, false friends, common errors'),
      caution_vn: z.string().optional().describe('Cautions in Vietnamese'),
      dailyUseTokensJson: z.any().optional(),
      dailyUseTokensJson_vn: z.any().optional(),
      professionalUseTokensJson: z.any().optional(),
      professionalUseTokensJson_vn: z.any().optional(),
      context: z.string().optional().describe('Sentence context where this word was captured'),
      isProcessed: z.boolean().optional().describe('True if this word is fully filled out, false if waiting in queue'),
      userId: z.string().optional().describe('User ID for multi-user support'),
    },
    async ({ dailyUseTokensJson, dailyUseTokensJson_vn, professionalUseTokensJson, professionalUseTokensJson_vn, ...fields }) => {
      const compDaily = compileTokenInput(dailyUseTokensJson);
      const compDailyVn = compileTokenInput(dailyUseTokensJson_vn);
      const compProf = compileTokenInput(professionalUseTokensJson);
      const compProfVn = compileTokenInput(professionalUseTokensJson_vn);

      const result = await gristPost('/tables/Vocabulary/records', {
        records: [
          {
            fields: {
              ...fields,
              dailyUse: compDaily && compDaily.text ? compDaily.text : fields.dailyUse,
              dailyUse_vn: compDailyVn && compDailyVn.text ? compDailyVn.text : fields.dailyUse_vn,
              professionalUse: compProf && compProf.text ? compProf.text : fields.professionalUse,
              professionalUse_vn: compProfVn && compProfVn.text ? compProfVn.text : fields.professionalUse_vn,
              dailyUseTokensJson: compDaily ? (typeof compDaily === 'string' ? compDaily : JSON.stringify(compDaily)) : undefined,
              dailyUseTokensJson_vn: compDailyVn ? (typeof compDailyVn === 'string' ? compDailyVn : JSON.stringify(compDailyVn)) : undefined,
              professionalUseTokensJson: compProf ? (typeof compProf === 'string' ? compProf : JSON.stringify(compProf)) : undefined,
              professionalUseTokensJson_vn: compProfVn ? (typeof compProfVn === 'string' ? compProfVn : JSON.stringify(compProfVn)) : undefined,
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
      meanings_vn: z.string().optional(),
      grammar: z.string().optional(),
      grammar_vn: z.string().optional(),
      dailyUse: z.string().optional(),
      dailyUse_vn: z.string().optional(),
      professionalUse: z.string().optional(),
      professionalUse_vn: z.string().optional(),
      tips: z.string().optional(),
      tips_vn: z.string().optional(),
      caution: z.string().optional(),
      caution_vn: z.string().optional(),
      dailyUseTokensJson: z.any().optional(),
      dailyUseTokensJson_vn: z.any().optional(),
      professionalUseTokensJson: z.any().optional(),
      professionalUseTokensJson_vn: z.any().optional(),
      context: z.string().optional(),
      isProcessed: z.boolean().optional(),
    },
    async ({ id, dailyUseTokensJson, dailyUseTokensJson_vn, professionalUseTokensJson, professionalUseTokensJson_vn, ...fields }) => {
      const compDaily = compileTokenInput(dailyUseTokensJson);
      const compDailyVn = compileTokenInput(dailyUseTokensJson_vn);
      const compProf = compileTokenInput(professionalUseTokensJson);
      const compProfVn = compileTokenInput(professionalUseTokensJson_vn);

      const patchFields: Partial<VocabularyFields> = {
        ...fields,
        dailyUse: compDaily && compDaily.text ? compDaily.text : fields.dailyUse,
        dailyUse_vn: compDailyVn && compDailyVn.text ? compDailyVn.text : fields.dailyUse_vn,
        professionalUse: compProf && compProf.text ? compProf.text : fields.professionalUse,
        professionalUse_vn: compProfVn && compProfVn.text ? compProfVn.text : fields.professionalUse_vn,
        dailyUseTokensJson: compDaily ? (typeof compDaily === 'string' ? compDaily : JSON.stringify(compDaily)) : undefined,
        dailyUseTokensJson_vn: compDailyVn ? (typeof compDailyVn === 'string' ? compDailyVn : JSON.stringify(compDailyVn)) : undefined,
        professionalUseTokensJson: compProf ? (typeof compProf === 'string' ? compProf : JSON.stringify(compProf)) : undefined,
        professionalUseTokensJson_vn: compProfVn ? (typeof compProfVn === 'string' ? compProfVn : JSON.stringify(compProfVn)) : undefined,
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
      userId: z.string().optional().describe('Filter by user ID for multi-user support'),
    },
    async ({ status, userId }) => {
      const filters: Record<string, any[]> = {};
      if (status) filters.status = [status];
      if (userId) filters.userId = [userId];

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

  server.tool(
    'list_vocabulary_usage',
    'List VocabularyUsage records for a given vocab word, optionally filtered by profession.',
    {
      vocabId: z.number().describe('Grist row ID of the vocabulary item'),
      profession: z.string().optional().describe('Filter by profession context'),
    },
    async ({ vocabId, profession }) => {
      const filters: Record<string, any[]> = { vocabId: [vocabId] };
      if (profession) filters.profession = [profession];
      const query = gristFilter(filters);
      const data = await gristGet<GristRecordsResponse<VocabularyUsageFields>>(
        `/tables/VocabularyUsage/records${query}`,
      );
      const items = data.records.map((r) => ({ id: r.id, ...r.fields }));
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }],
      };
    },
  );

  server.tool(
    'add_vocabulary_usage',
    'Add a profession-specific usage entry for a vocabulary word (dailyUse, professionalUse, tips, caution).',
    {
      vocabId: z.number().describe('Grist row ID of the vocabulary item'),
      profession: z.string().describe('Profession context (e.g. Software Engineer)'),
      dailyUse: z.string().describe('Daily example sentence with translation'),
      dailyUse_vn: z.string().optional().describe('Daily example sentence with Vietnamese translation'),
      professionalUse: z.string().describe('Professional example sentence with translation'),
      professionalUse_vn: z.string().optional().describe('Professional example sentence with Vietnamese translation'),
      tips: z.string().describe('Grammatical tips and cases'),
      tips_vn: z.string().optional().describe('Grammatical tips in Vietnamese'),
      caution: z.string().describe('Common pitfalls or false friends'),
      caution_vn: z.string().optional().describe('Common pitfalls in Vietnamese'),
    },
    async (fields) => {
      const result = await gristPost('/tables/VocabularyUsage/records', {
        records: [
          {
            fields: {
              ...fields,
              createdAt: new Date().toISOString(),
            },
          },
        ],
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `VocabularyUsage entry added with ID ${result.records[0].id}.`,
          },
        ],
      };
    },
  );
}
