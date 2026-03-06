const assert = require('assert');
const ivm = require('isolated-vm');

function assertBoundaryStack(err, originPattern, label) {
	const stack = String(err && err.stack);
	assert.ok(originPattern.test(stack), `missing origin frame for ${label}:\n${stack}`);
	assert.ok(/<isolated-vm boundary>/.test(stack), `missing boundary frame for ${label}:\n${stack}`);
}

async function caseContextEvalPendingReject() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	try {
		await context.eval(
			'Promise.resolve().then(function evalReject(){ throw new Error("eval-async-frame"); });',
			{ promise: true, filename: 'eval-async.js' }
		);
		assert.fail('Expected eval rejection');
	} catch (err) {
		assertBoundaryStack(err, /evalReject .*eval-async\.js/, 'context.eval pending reject');
	}
}

async function caseContextEvalImmediateReject() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	try {
		await context.eval('Promise.reject(new Error("eval-immediate-reject"))', {
			promise: true,
			filename: 'eval-immediate.js',
		});
		assert.fail('Expected eval immediate rejection');
	} catch (err) {
		assertBoundaryStack(err, /eval-immediate\.js/, 'context.eval immediate reject');
	}
}

async function caseScriptRunPendingReject() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const script = isolate.compileScriptSync(
		'Promise.resolve().then(function runReject(){ throw new Error("run-async-frame"); });',
		{ filename: 'run-async.js' }
	);
	try {
		await script.run(context, { promise: true });
		assert.fail('Expected script.run rejection');
	} catch (err) {
		assertBoundaryStack(err, /runReject .*run-async\.js/, 'script.run pending reject');
	}
}

async function caseEvalClosurePendingReject() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	try {
		await context.evalClosure(
			'return Promise.resolve().then(function closureReject(){ throw new Error("closure-async-frame"); });',
			[],
			{ result: { promise: true } }
		);
		assert.fail('Expected evalClosure rejection');
	} catch (err) {
		assertBoundaryStack(err, /closureReject/, 'evalClosure pending reject');
	}
}

async function caseReferenceApplyPendingReject() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const asyncRef = context.evalSync(
		'(function asyncThrow(){ return Promise.resolve().then(function innerAsync(){ throw new Error("ref-async-frame"); }); })',
		{ reference: true }
	);
	try {
		await asyncRef.apply(undefined, [], { result: { promise: true } });
		assert.fail('Expected reference.apply rejection');
	} catch (err) {
		assertBoundaryStack(err, /innerAsync/, 'reference.apply pending reject');
	}
}

async function caseStackGetterSafeReject() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	try {
		await context.eval(
			`Promise.reject((() => {
				const err = new Error('original-promise-error');
				Object.defineProperty(err, 'stack', { get() { throw new Error('stack-getter-denied'); } });
				return err;
			})())`,
			{ promise: true }
		);
		assert.fail('Expected stack-getter rejection');
	} catch (err) {
		assert.equal(err.message, 'original-promise-error');
	}
}

(async function() {
	await caseContextEvalPendingReject();
	await caseContextEvalImmediateReject();
	await caseScriptRunPendingReject();
	await caseEvalClosurePendingReject();
	await caseReferenceApplyPendingReject();
	await caseStackGetterSafeReject();
	console.log('pass');
})().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
