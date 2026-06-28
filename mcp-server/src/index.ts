import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerContextTools } from './tools/context.js';
import { registerVocabularyTools } from './tools/vocabulary.js';
import { registerExerciseTools } from './tools/exercises.js';

const server = new McpServer({
  name: 'german-learning-instructor',
  version: '1.0.0',
});

// Register all tools
registerContextTools(server);
registerVocabularyTools(server);
registerExerciseTools(server);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
