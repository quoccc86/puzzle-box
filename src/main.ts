const root = document.getElementById('app');
if (!root) throw new Error('#app root not found');

const heading = document.createElement('h1');
heading.textContent = 'Puzzle Box';
root.append(heading);
