import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { gristGet, gristPut, gristFilter } from '../clients/grist.js';
import type {
  GristRecordsResponse,
  WritingPracticeFields,
  ReadingPracticeFields,
  SpeakingPracticeFields,
} from '../types.js';

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function isLevelLowerOrEqual(itemLevel: string, userLevel: string): boolean {
  const itemIdx = LEVEL_ORDER.indexOf(itemLevel);
  const userIdx = LEVEL_ORDER.indexOf(userLevel);
  if (itemIdx === -1) return true;
  if (userIdx === -1) return true;
  return itemIdx <= userIdx;
}

async function getProfileTargetLevel(userId?: string): Promise<string> {
  if (!userId) return 'B1';
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) return 'B1';

    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        }
      }
    );
    if (!res.ok) return 'B1';
    const rows = await res.json() as any[];
    return rows?.[0]?.targetLevel ?? 'B1';
  } catch {
    return 'B1';
  }
}

async function getProfileProfession(userId?: string): Promise<string> {
  if (!userId) return 'software_engineer';
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) return 'software_engineer';

    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        }
      }
    );
    if (!res.ok) return 'software_engineer';
    const rows = await res.json() as any[];
    return rows?.[0]?.profession ?? 'software_engineer';
  } catch {
    return 'software_engineer';
  }
}

export function registerExerciseTools(server: McpServer) {
  // ─── Writing Practice Tools ────────────────────────────────────
  server.tool(
    'list_writing_practice',
    'List writing practice sessions for the user, merging global templates and user attempts.',
    {
      status: z.enum(['pending_user', 'pending_correction', 'corrected']).optional(),
      userId: z.string().optional().describe('User ID for multi-user support'),
    },
    async ({ status, userId }) => {
      const userProfession = await getProfileProfession(userId);

      // 1. Fetch templates for user's profession
      const query = gristFilter({ profession: [userProfession] });
      const templatesData = await gristGet<GristRecordsResponse<any>>(
        `/tables/WritingPractice/records${query}`,
      );

      if (templatesData.records.length === 0) {
        return { content: [{ type: 'text' as const, text: '[]' }] };
      }

      // 2. Fetch submissions for this user
      let subsMap = new Map<number, any>();
      if (userId) {
        const practiceIds = templatesData.records.map((t) => t.id);
        const subQuery = gristFilter({ userId: [userId], practiceId: practiceIds });
        const subsData = await gristGet<GristRecordsResponse<any>>(
          `/tables/WritingPracticeSubmission/records${subQuery}`,
        );
        for (const r of subsData.records) {
          const pId = Array.isArray(r.fields.practiceId) ? r.fields.practiceId[1] : r.fields.practiceId;
          if (typeof pId === 'number') subsMap.set(pId, r.fields);
        }
      }

      // 3. Merge
      let items = templatesData.records.map((r) => {
        const sub = subsMap.get(r.id);
        return {
          id: r.id,
          topic: r.fields.topic,
          description: r.fields.description,
          profession: r.fields.profession,
          level: r.fields.level ?? 'B1',
          userParagraph: sub?.userParagraph ?? '',
          correctedParagraph: sub?.correctedParagraph ?? '',
          correctionsJson: sub?.correctionsJson ?? '',
          correctionsJson_vn: sub?.correctionsJson_vn ?? '',
          status: sub?.status ?? 'pending_user',
          date: sub?.date ?? new Date().toISOString().split('T')[0],
          userId: sub?.userId ?? userId ?? '',
        };
      });

      const targetLevel = await getProfileTargetLevel(userId);
      items = items.filter((item) => isLevelLowerOrEqual(item.level, targetLevel));

      if (status) {
        items = items.filter((item) => item.status === status);
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }],
      };
    },
  );

  server.tool(
    'upsert_writing_practice',
    'Create a writing template or submit/correct a user attempt.',
    {
      id: z.number().optional().describe('Grist template ID or submission ID'),
      topic: z.string().optional(),
      description: z.string().optional(),
      userParagraph: z.string().optional(),
      correctedParagraph: z.string().optional(),
      correctionsJson: z.string().optional(),
      correctionsJson_vn: z.string().optional(),
      status: z.enum(['pending_user', 'pending_correction', 'corrected']).optional(),
      date: z.string().optional(),
      userId: z.string().optional(),
    },
    async ({ id, topic, description, userId, ...fields }) => {
      const userProfession = await getProfileProfession(userId);

      // Case A: Creating/updating a global template (no userParagraph provided)
      if (description && !fields.userParagraph) {
        await gristPut('/tables/WritingPractice/records', {
          records: [
            {
              require: id ? { id } : { topic: topic || '' },
              fields: {
                topic: topic || '',
                description,
                profession: userProfession,
              },
            },
          ],
        });
        return { content: [{ type: 'text' as const, text: `Writing practice template saved.` }] };
      }

      // Case B: Submitting/Evaluating a user attempt
      let practiceId = id;
      if (!practiceId && topic) {
        const query = gristFilter({ topic: [topic] });
        const res = await gristGet<GristRecordsResponse<any>>(`/tables/WritingPractice/records${query}`);
        if (res.records.length > 0) {
          practiceId = res.records[0].id;
        }
      }

      if (!practiceId) {
        return { content: [{ type: 'text' as const, text: `Error: Writing practice template not found.` }] };
      }

      if (!userId) {
        return { content: [{ type: 'text' as const, text: `Error: userId is required for submissions.` }] };
      }

      await gristPut('/tables/WritingPracticeSubmission/records', {
        records: [
          {
            require: { practiceId, userId },
            fields: {
              ...fields,
              practiceId,
              userId,
              date: fields.date || new Date().toISOString().split('T')[0],
              updatedAt: new Date().toISOString(),
            },
          },
        ],
      });

      return { content: [{ type: 'text' as const, text: `Writing practice submission saved.` }] };
    },
  );

  // ─── Reading Practice Tools ────────────────────────────────────
  server.tool(
    'list_reading_practice',
    'List reading practice sessions, merging templates and user submissions.',
    {
      status: z.enum(['pending_user', 'pending_evaluation', 'evaluated']).optional(),
      userId: z.string().optional(),
    },
    async ({ status, userId }) => {
      const userProfession = await getProfileProfession(userId);

      const query = gristFilter({ profession: [userProfession] });
      const templatesData = await gristGet<GristRecordsResponse<any>>(
        `/tables/ReadingPractice/records${query}`,
      );

      if (templatesData.records.length === 0) {
        return { content: [{ type: 'text' as const, text: '[]' }] };
      }

      let subsMap = new Map<number, any>();
      if (userId) {
        const practiceIds = templatesData.records.map((t) => t.id);
        const subQuery = gristFilter({ userId: [userId], practiceId: practiceIds });
        const subsData = await gristGet<GristRecordsResponse<any>>(
          `/tables/ReadingPracticeSubmission/records${subQuery}`,
        );
        for (const r of subsData.records) {
          const pId = Array.isArray(r.fields.practiceId) ? r.fields.practiceId[1] : r.fields.practiceId;
          if (typeof pId === 'number') subsMap.set(pId, r.fields);
        }
      }

      let items = templatesData.records.map((r) => {
        const sub = subsMap.get(r.id);
        return {
          id: r.id,
          topic: r.fields.topic,
          germanText: r.fields.germanText,
          audioFileId: r.fields.audioFileId,
          questionsJson: r.fields.questionsJson,
          profession: r.fields.profession,
          level: r.fields.level ?? 'B1',
          userAnswersJson: sub?.userAnswersJson ?? '',
          correctionsJson: sub?.correctionsJson ?? '',
          correctionsJson_vn: sub?.correctionsJson_vn ?? '',
          status: sub?.status ?? 'pending_user',
          date: sub?.date ?? new Date().toISOString().split('T')[0],
          userId: sub?.userId ?? userId ?? '',
        };
      });

      const targetLevel = await getProfileTargetLevel(userId);
      items = items.filter((item) => isLevelLowerOrEqual(item.level, targetLevel));

      if (status) {
        items = items.filter((item) => item.status === status);
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }],
      };
    },
  );

  server.tool(
    'upsert_reading_practice',
    'Create reading template or submit/grade a user attempt.',
    {
      id: z.number().optional(),
      topic: z.string().optional(),
      germanText: z.string().optional(),
      audioFileId: z.string().optional(),
      questionsJson: z.string().optional(),
      userAnswersJson: z.string().optional(),
      correctionsJson: z.string().optional(),
      correctionsJson_vn: z.string().optional(),
      status: z.enum(['pending_user', 'pending_evaluation', 'evaluated']).optional(),
      date: z.string().optional(),
      userId: z.string().optional(),
    },
    async ({ id, topic, germanText, audioFileId, questionsJson, userId, ...fields }) => {
      const userProfession = await getProfileProfession(userId);

      // Case A: Create/update template
      if (germanText && !fields.userAnswersJson) {
        await gristPut('/tables/ReadingPractice/records', {
          records: [
            {
              require: id ? { id } : { topic: topic || '' },
              fields: {
                topic: topic || '',
                germanText,
                audioFileId: audioFileId || '',
                questionsJson: questionsJson || '[]',
                profession: userProfession,
              },
            },
          ],
        });
        return { content: [{ type: 'text' as const, text: `Reading practice template saved.` }] };
      }

      // Case B: Submit user attempt
      let practiceId = id;
      if (!practiceId && topic) {
        const query = gristFilter({ topic: [topic] });
        const res = await gristGet<GristRecordsResponse<any>>(`/tables/ReadingPractice/records${query}`);
        if (res.records.length > 0) {
          practiceId = res.records[0].id;
        }
      }

      if (!practiceId) {
        return { content: [{ type: 'text' as const, text: `Error: Reading practice template not found.` }] };
      }

      if (!userId) {
        return { content: [{ type: 'text' as const, text: `Error: userId is required for submissions.` }] };
      }

      await gristPut('/tables/ReadingPracticeSubmission/records', {
        records: [
          {
            require: { practiceId, userId },
            fields: {
              ...fields,
              practiceId,
              userId,
              date: fields.date || new Date().toISOString().split('T')[0],
              updatedAt: new Date().toISOString(),
            },
          },
        ],
      });

      return { content: [{ type: 'text' as const, text: `Reading practice submission saved.` }] };
    },
  );

  // ─── Speaking Practice Tools ───────────────────────────────────
  server.tool(
    'list_speaking_practice',
    'List speaking practice sessions, merging templates and user submissions.',
    {
      status: z.enum(['pending_recording', 'pending_assessment', 'assessed']).optional(),
      userId: z.string().optional(),
    },
    async ({ status, userId }) => {
      const userProfession = await getProfileProfession(userId);

      const query = gristFilter({ profession: [userProfession] });
      const templatesData = await gristGet<GristRecordsResponse<any>>(
        `/tables/SpeakingPractice/records${query}`,
      );

      if (templatesData.records.length === 0) {
        return { content: [{ type: 'text' as const, text: '[]' }] };
      }

      let subsMap = new Map<number, any>();
      if (userId) {
        const practiceIds = templatesData.records.map((t) => t.id);
        const subQuery = gristFilter({ userId: [userId], practiceId: practiceIds });
        const subsData = await gristGet<GristRecordsResponse<any>>(
          `/tables/SpeakingPracticeSubmission/records${subQuery}`,
        );
        for (const r of subsData.records) {
          const pId = Array.isArray(r.fields.practiceId) ? r.fields.practiceId[1] : r.fields.practiceId;
          if (typeof pId === 'number') subsMap.set(pId, r.fields);
        }
      }

      let items = templatesData.records.map((r) => {
        const sub = subsMap.get(r.id);
        return {
          id: r.id,
          topic: r.fields.topic,
          targetText: r.fields.targetText,
          targetAudioFileId: r.fields.targetAudioFileId,
          profession: r.fields.profession,
          level: r.fields.level ?? 'B1',
          userAudioFileId: sub?.userAudioFileId ?? '',
          transcript: sub?.transcript ?? '',
          grammarFeedback: sub?.grammarFeedback ?? '',
          grammarFeedback_vn: sub?.grammarFeedback_vn ?? '',
          pronunciationFeedback: sub?.pronunciationFeedback ?? '',
          pronunciationFeedback_vn: sub?.pronunciationFeedback_vn ?? '',
          score: sub?.score ?? 0,
          status: sub?.status ?? 'pending_recording',
          date: sub?.date ?? new Date().toISOString().split('T')[0],
          userId: sub?.userId ?? userId ?? '',
        };
      });

      const targetLevel = await getProfileTargetLevel(userId);
      items = items.filter((item) => isLevelLowerOrEqual(item.level, targetLevel));

      if (status) {
        items = items.filter((item) => item.status === status);
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }],
      };
    },
  );

  server.tool(
    'upsert_speaking_practice',
    'Create speaking template or submit/evaluate a user attempt.',
    {
      id: z.number().optional(),
      topic: z.string().optional(),
      targetText: z.string().optional(),
      userAudioFileId: z.string().optional(),
      transcript: z.string().optional(),
      grammarFeedback: z.string().optional(),
      grammarFeedback_vn: z.string().optional(),
      pronunciationFeedback: z.string().optional(),
      pronunciationFeedback_vn: z.string().optional(),
      targetAudioFileId: z.string().optional(),
      score: z.number().optional(),
      status: z.enum(['pending_recording', 'pending_assessment', 'assessed']).optional(),
      date: z.string().optional(),
      userId: z.string().optional(),
    },
    async ({ id, topic, targetText, targetAudioFileId, userId, ...fields }) => {
      const userProfession = await getProfileProfession(userId);

      // Case A: Create/update template
      if (targetText && !fields.userAudioFileId) {
        await gristPut('/tables/SpeakingPractice/records', {
          records: [
            {
              require: id ? { id } : { topic: topic || '' },
              fields: {
                topic: topic || '',
                targetText,
                targetAudioFileId: targetAudioFileId || '',
                profession: userProfession,
              },
            },
          ],
        });
        return { content: [{ type: 'text' as const, text: `Speaking practice template saved.` }] };
      }

      // Case B: Submit user attempt
      let practiceId = id;
      if (!practiceId && topic) {
        const query = gristFilter({ topic: [topic] });
        const res = await gristGet<GristRecordsResponse<any>>(`/tables/SpeakingPractice/records${query}`);
        if (res.records.length > 0) {
          practiceId = res.records[0].id;
        }
      }

      if (!practiceId) {
        return { content: [{ type: 'text' as const, text: `Error: Speaking practice template not found.` }] };
      }

      if (!userId) {
        return { content: [{ type: 'text' as const, text: `Error: userId is required for submissions.` }] };
      }

      await gristPut('/tables/SpeakingPracticeSubmission/records', {
        records: [
          {
            require: { practiceId, userId },
            fields: {
              ...fields,
              practiceId,
              userId,
              date: fields.date || new Date().toISOString().split('T')[0],
              updatedAt: new Date().toISOString(),
            },
          },
        ],
      });

      return { content: [{ type: 'text' as const, text: `Speaking practice submission saved.` }] };
    },
  );
}
