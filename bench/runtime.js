'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scripts = [
	'bench/micro/startup.js',
	'bench/micro/reference.js',
	'bench/micro/external-copy.js',
];

for (const script of scripts) {
	console.log(`\n## ${script}`);
	const result = spawnSync(process.execPath, ['--no-node-snapshot', path.join(root, script)], {
		cwd: root,
		encoding: 'utf8',
	});
	if (result.stdout) {
		process.stdout.write(result.stdout);
	}
	if (result.stderr) {
		process.stderr.write(result.stderr);
	}
	if (result.status !== 0) {
		process.exit(result.status || 1);
	}
}
