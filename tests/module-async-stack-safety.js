const ivm = require('isolated-vm');
const assert = require('assert');

function hasNoAccess(err) {
	const parts = [];
	try {
		parts.push(String(err));
	} catch {}
	try {
		parts.push(String(err && err.message));
	} catch {}
	try {
		parts.push(String(err && err.stack));
	} catch {}
	return /TypeError:\s*no access/i.test(parts.join('\n')) || /\bno access\b/i.test(parts.join('\n'));
}

async function getModuleError(modules, context) {
	await modules['./a.js'].instantiate(context, specifier => modules[specifier]);
	try {
		await modules['./a.js'].evaluate();
		assert.fail('Expected module evaluation to reject');
	} catch (err) {
		return err;
	}
}

async function caseRecoversModuleFrames() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const modules = {
		'./a.js': isolate.compileModuleSync(
			`import { fromB } from './b.js';
			Promise.resolve().then(() => fromB());`,
			{ filename: 'a.js' }
		),
		'./b.js': isolate.compileModuleSync(
			`import { fromC } from './c.js';
			export function fromB() {
				return fromC().then(function afterFromC() {
					throw new Error('module-chain');
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

	const err = await getModuleError(modules, context);
	assert.ok(/module-chain/.test(err.message));
	assert.ok(err.stack.includes('<isolated-vm boundary>'));
	assert.ok(err.stack.includes('a.js'));
	assert.ok(err.stack.includes('b.js'));
	assert.ok(/afterFromC/.test(err.stack));
}

async function caseForeignCrossContextReason() {
	const isolate = new ivm.Isolate();
	const contextA = isolate.createContextSync();
	const contextB = isolate.createContextSync();
	const foreign = contextB.evalSync(`new Error('foreign-reason')`, { reference: true });
	contextA.global.setSync('foreignErr', foreign.derefInto());

	const modules = {
		'./a.js': isolate.compileModuleSync(
			`import { fromB } from './b.js';
			Promise.resolve().then(() => fromB());`,
			{ filename: 'a.js' }
		),
		'./b.js': isolate.compileModuleSync(
			`export function fromB() {
				return Promise.resolve().then(function throwForeign() {
					throw foreignErr;
				});
			}`,
			{ filename: 'b.js' }
		),
	};

	const err = await getModuleError(modules, contextA);
	assert.ok(/foreign-reason/.test(String(err)));
	assert.ok(!hasNoAccess(err));
}

async function caseStackGetterThrows() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const modules = {
		'./a.js': isolate.compileModuleSync(
			`import { fromB } from './b.js';
			Promise.resolve().then(() => fromB());`,
			{ filename: 'a.js' }
		),
		'./b.js': isolate.compileModuleSync(
			`class GetterError extends Error {
				get stack() { throw new TypeError('denied-getter'); }
			}
			export function fromB() {
				return Promise.resolve().then(function throwGetterError() {
					throw new GetterError('getter-error');
				});
			}`,
			{ filename: 'b.js' }
		),
	};

	const err = await getModuleError(modules, context);
	assert.ok(/getter-error/.test(String(err)));
	assert.ok(!hasNoAccess(err));
}

async function caseStackSetterIsIgnored() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const modules = {
		'./a.js': isolate.compileModuleSync(
			`import { fromB } from './b.js';
			Promise.resolve().then(() => fromB());`,
			{ filename: 'a.js' }
		),
		'./b.js': isolate.compileModuleSync(
			`export function fromB() {
				return Promise.resolve().then(function throwFrozenStackError() {
					const err = new Error('setter-path');
					Object.defineProperty(err, 'stack', { value: 'locked', writable: false });
					throw err;
				});
			}`,
			{ filename: 'b.js' }
		),
	};

	const err = await getModuleError(modules, context);
	assert.ok(/setter-path/.test(String(err)));
	assert.ok(!hasNoAccess(err));
}

async function caseHostPromisePath() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const unhandled = [];
	const onUnhandled = reason => {
		unhandled.push(reason);
	};
	process.on('unhandledRejection', onUnhandled);
	context.global.setSync('hostAsync', new ivm.Reference(() => Promise.reject(new Error('host-path'))));

	const modules = {
		'./a.js': isolate.compileModuleSync(
			`import { fromB } from './b.js';
			Promise.resolve().then(() => fromB());`,
			{ filename: 'a.js' }
		),
		'./b.js': isolate.compileModuleSync(
			`export function fromB() {
				return hostAsync.apply(undefined, []);
			}`,
			{ filename: 'b.js' }
		),
	};

	try {
		const err = await getModuleError(modules, context);
		assert.ok(!hasNoAccess(err));
	} finally {
		// Give host-side promise jobs a turn in case this route rejects on host side.
		await new Promise(resolve => setImmediate(resolve));
		process.removeListener('unhandledRejection', onUnhandled);
	}
	for (const reason of unhandled) {
		assert.ok(!hasNoAccess(reason));
	}
}

async function caseContextReleaseRace() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const modules = {
		'./a.js': isolate.compileModuleSync(
			`import { fromB } from './b.js';
			Promise.resolve().then(() => fromB());`,
			{ filename: 'a.js' }
		),
		'./b.js': isolate.compileModuleSync(
			`export function fromB() {
				return Promise.resolve().then(function raceThrow() {
					throw new Error('race-case');
				});
			}`,
			{ filename: 'b.js' }
		),
	};

	await modules['./a.js'].instantiate(context, specifier => modules[specifier]);
	const pending = modules['./a.js'].evaluate();
	context.release();
	try {
		await pending;
		assert.fail('Expected race case to reject');
	} catch (err) {
		assert.ok(!hasNoAccess(err));
	}
}

async function caseNoAccessStressSweep() {
	const maxIter = 300;
	for (let ii = 0; ii < maxIter; ++ii) {
		const isolate = new ivm.Isolate();
		const contextA = isolate.createContextSync();
		const contextB = isolate.createContextSync();
		const foreignErr = contextB.evalSync(`new Error('foreign-${ii}')`, { reference: true });
		contextA.global.setSync('foreignErr', foreignErr.derefInto());

		const variants = [
			`export function fromB() { return Promise.resolve().then(function throwForeign() { throw foreignErr; }); }`,
			`export function fromB() { return Promise.resolve().then(function throwLocal() { throw new Error('local-${ii}'); }); }`,
		];

		for (const codeB of variants) {
			const modules = {
				'./a.js': isolate.compileModuleSync(
					`import { fromB } from './b.js'; Promise.resolve().then(() => fromB());`,
					{ filename: 'a.js' }
				),
				'./b.js': isolate.compileModuleSync(codeB, { filename: 'b.js' }),
			};

			try {
				await modules['./a.js'].instantiate(contextA, specifier => modules[specifier]);
				const evalPromise = modules['./a.js'].evaluate();
				if ((ii & 3) === 0) {
					contextB.release();
				}
				await evalPromise;
				assert.fail('Expected stress eval to reject');
			} catch (err) {
				assert.ok(!hasNoAccess(err), `unexpected no-access error: ${String(err)}`);
			}
		}
	}
}

(async function() {
	await caseRecoversModuleFrames();
	await caseForeignCrossContextReason();
	await caseStackGetterThrows();
	await caseStackSetterIsIgnored();
	await caseHostPromisePath();
	await caseContextReleaseRace();
	await caseNoAccessStressSweep();
	console.log('pass');
})().catch((err) => {
	console.error(err);
});
