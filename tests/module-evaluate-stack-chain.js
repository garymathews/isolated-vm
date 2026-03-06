const ivm = require('isolated-vm');
const assert = require('assert');

(async function() {
	const runSingleCase = async () => {
		const isolate = new ivm.Isolate();
		const context = isolate.createContextSync();
		const modules = {
			'./a.js': isolate.compileModuleSync(
				`import { fromB } from './b.js';
				Promise.resolve().then(() => fromB());
				export const marker = 'a';`,
				{ filename: 'a.js' }
			),
			'./b.js': isolate.compileModuleSync(
				`import { fromC } from './c.js';
				export function fromB() {
					return fromC().then(function afterFromC() {
						throw new Error('module-stack-chain');
					});
				}`,
				{ filename: 'b.js' }
			),
			'./c.js': isolate.compileModuleSync(
				`export function fromC() {
					return Promise.resolve('ok');
				}`,
				{ filename: 'c.js' }
			),
		};

		await modules['./a.js'].instantiate(context, specifier => modules[specifier]);
		try {
			await modules['./a.js'].evaluate();
			throw new Error('expected evaluate to reject');
		} catch (err) {
			assert.ok(/module-stack-chain/.test(err.message));
			assert.ok(err.stack.includes('<isolated-vm boundary>'));
			assert.ok(err.stack.includes('a.js'));
			assert.ok(err.stack.includes('b.js'));
			assert.ok(/afterFromC/.test(err.stack));
			const aFrame = err.stack.split('\n').find(line => line.includes('a.js'));
			const bFrame = err.stack.split('\n').find(line => line.includes('afterFromC') && line.includes('b.js'));
			assert.ok(aFrame && /:\d+:\d+\)?$/.test(aFrame));
			assert.ok(!/a\.js:1:1\)?$/.test(aFrame), `unexpected placeholder frame: ${aFrame}`);
			assert.ok(bFrame && /:\d+:\d+\)?$/.test(bFrame));
			if (err.stack.includes('fromC')) {
				assert.ok(err.stack.includes('c.js'));
			}
		}
	};

	const runConcurrentCase = async () => {
		const isolate = new ivm.Isolate();
		const context = isolate.createContextSync();
		const modules = {
			'./a1.js': isolate.compileModuleSync(
				`import { fromB } from './b1.js';
				Promise.resolve().then(() => fromB());`,
				{ filename: 'a1.js' }
			),
			'./b1.js': isolate.compileModuleSync(
				`export function fromB() {
					return Promise.resolve().then(function fail1() {
						throw new Error('module-stack-1');
					});
				}`,
				{ filename: 'b1.js' }
			),
			'./a2.js': isolate.compileModuleSync(
				`import { fromB } from './b2.js';
				Promise.resolve().then(() => fromB());`,
				{ filename: 'a2.js' }
			),
			'./b2.js': isolate.compileModuleSync(
				`export function fromB() {
					return Promise.resolve().then(function fail2() {
						throw new Error('module-stack-2');
					});
				}`,
				{ filename: 'b2.js' }
			),
		};
		await Promise.all([
			modules['./a1.js'].instantiate(context, specifier => modules[specifier]),
			modules['./a2.js'].instantiate(context, specifier => modules[specifier]),
		]);
		const [r1, r2] = await Promise.allSettled([
			modules['./a1.js'].evaluate(),
			modules['./a2.js'].evaluate(),
		]);
		assert.equal(r1.status, 'rejected');
		assert.equal(r2.status, 'rejected');
		assert.ok(r1.reason.stack.includes('a1.js'));
		assert.ok(r2.reason.stack.includes('a2.js'));
		assert.ok(!r1.reason.stack.includes('a2.js'));
		assert.ok(!r2.reason.stack.includes('a1.js'));
	};

	await runSingleCase();
	await runConcurrentCase();

	console.log('pass');
})().catch(console.error);
