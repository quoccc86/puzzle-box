import { listGames } from './core/registry';
import { createApp } from './ui/app';

// Registering games: each game module registers itself on import.
// This is the only place that imports game folders (core/ never does).
import './games/demo';
import './games/sokoban';

const root = document.getElementById('app');
if (!root) throw new Error('#app root not found');

const app = createApp(root);
app.start(listGames());
