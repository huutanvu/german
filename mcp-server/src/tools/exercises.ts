import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { gristGet, gristPut, gristFilter } from '../clients/grist.js';
import type {
  GristRecordsResponse,
  WritingPracticeFields,
  ReadingPracticeFields,
  SpeakingPracticeFields,
} from '../types.js';

export function registerExerciseTools(server: McpServer) {
  // ─── Writing Practice Tools ────────────────────────────────────
  server.tool(
    'list_writing_practice',
    'List writing practice sessions, optionally filtered by status (pending_user, pending_correction, corrected).',
    {
      status: z.enum(['pending_user', 'pending_correction', 'corrected']).optional(),
    },
    async ({ status }) => {
      const filters: Record<string, any[]> = {};
      if (status) filters.status = [status];

      const query = Object.keys(filters).length ? gristFilter(filters) : '';
      const data = await gristGet<GristRecordsResponse<WritingPracticeFields>>(
        `/tables/WritingPractice/records${query}`,
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
    'upsert_writing_practice',
    'Create or update a writing practice session. Use this to post topics or submit user corrections.',
    {
      id: z.number().optional().describe('Grist row ID to update (leave blank to create a new session)'),
      topic: z.string().optional(),
      description: z.string().optional(),
      userParagraph: z.string().optional(),
      correctedParagraph: z.string().optional(),
      correctionsJson: z.string().optional().describe('Sentence-by-sentence analysis of errors'),
      status: z.enum(['pending_user', 'pending_correction', 'corrected']).optional(),
      date: z.string().optional().describe('Format YYYY-MM-DD'),
    },
    async ({ id, ...fields }) => {
      const requireFields: Record<string, any> = {};
      if (id) {
        requireFields.id = id;
      } else {
        requireFields.date = fields.date || new Date().toISOString().split('T')[0];
        requireFields.topic = fields.topic || '';
      }

      await gristPut('/tables/WritingPractice/records', {
        records: [
          {
            require: requireFields,
            fields,
          },
        ],
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Writing practice session saved successfully.`,
          },
        ],
      };
    },
  );

  // ─── Reading Practice Tools ────────────────────────────────────
  server.tool(
    'list_reading_practice',
    'List reading practice sessions, optionally filtered by status (pending_user, pending_evaluation, evaluated).',
    {
      status: z.enum(['pending_user', 'pending_evaluation', 'evaluated']).optional(),
    },
    async ({ status }) => {
      const filters: Record<string, any[]> = {};
      if (status) filters.status = [status];

      const query = Object.keys(filters).length ? gristFilter(filters) : '';
      const data = await gristGet<GristRecordsResponse<ReadingPracticeFields>>(
        `/tables/ReadingPractice/records${query}`,
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
    'upsert_reading_practice',
    'Create or update a reading practice session. Used to generate passages or submit grading feedback.',
    {
      id: z.number().optional().describe('Grist row ID to update (leave blank to create a new session)'),
      topic: z.string().optional(),
      germanText: z.string().optional(),
      audioFileId: z.string().optional().describe('Publitio file ID'),
      questionsJson: z.string().optional().describe('JSON array of 5 comprehension questions'),
      userAnswersJson: z.string().optional().describe('JSON array of user answers'),
      correctionsJson: z.string().optional().describe('AI evaluations and corrections'),
      status: z.enum(['pending_user', 'pending_evaluation', 'evaluated']).optional(),
      date: z.string().optional().describe('Format YYYY-MM-DD'),
    },
    async ({ id, ...fields }) => {
      const requireFields: Record<string, any> = {};
      if (id) {
        requireFields.id = id;
      } else {
        requireFields.date = fields.date || new Date().toISOString().split('T')[0];
        requireFields.topic = fields.topic || '';
      }

      await gristPut('/tables/ReadingPractice/records', {
        records: [
          {
            require: requireFields,
            fields,
          },
        ],
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Reading practice session saved successfully.`,
          },
        ],
      };
    },
  );

  // ─── Speaking Practice Tools ───────────────────────────────────
  server.tool(
    'list_speaking_practice',
    'List speaking practice sessions, optionally filtered by status (pending_recording, pending_assessment, assessed).',
    {
      status: z.enum(['pending_recording', 'pending_assessment', 'assessed']).optional(),
    },
    async ({ status }) => {
      const filters: Record<string, any[]> = {};
      if (status) filters.status = [status];

      const query = Object.keys(filters).length ? gristFilter(filters) : '';
      const data = await gristGet<GristRecordsResponse<SpeakingPracticeFields>>(
        `/tables/SpeakingPractice/records${query}`,
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
    'upsert_speaking_practice',
    'Create or update a speaking practice session. Used to log recorded audio or submit pronunciation reviews.',
    {
      id: z.number().optional().describe('Grist row ID to update (leave blank to create a new session)'),
      topic: z.string().optional(),
      targetText: z.string().optional(),
      userAudioFileId: z.string().optional().describe('Publitio file ID of user recorded audio'),
      transcript: z.string().optional().describe('Whisper transcript of user audio'),
      grammarFeedback: z.string().optional(),
      pronunciationFeedback: z.string().optional().describe('List of mispronounced words with guide'),
      targetAudioFileId: z.string().optional().describe('Publitio file ID of target pronunciation TTS audio'),
      score: z.number().optional(),
      status: z.enum(['pending_recording', 'pending_assessment', 'assessed']).optional(),
      date: z.string().optional().describe('Format YYYY-MM-DD'),
    },
    async ({ id, ...fields }) => {
      const requireFields: Record<string, any> = {};
      if (id) {
        requireFields.id = id;
      } else {
        requireFields.date = fields.date || new Date().toISOString().split('T')[0];
        requireFields.topic = fields.topic || '';
      }

      await gristPut('/tables/SpeakingPractice/records', {
        records: [
          {
            require: requireFields,
            fields,
          },
        ],
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Speaking practice session saved successfully.`,
          },
        ],
      };
    },
  );
}
