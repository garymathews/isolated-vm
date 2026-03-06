const assert = require('assert');
const ivm = require('isolated-vm');

function assertCallerContext(err, callerName, originPattern, label) {
	const stack = String(err && err.stack);
	assert.ok(originPattern.test(stack), `missing origin for ${label}:\n${stack}`);
	assert.ok(/<isolated-vm boundary>/.test(stack), `missing boundary for ${label}:\n${stack}`);
	assert.ok(new RegExp(callerName).test(stack), `missing caller context for ${label}:\n${stack}`);
}

async function caseEvalThenReject() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	function evalThenCaller() {
		return context.eval('Promise.resolve().then(function evalThenReject(){ throw new Error("eval-then-reject"); })', {
			promise: true,
			filename: 'eval-then-reject.js',
		});
	}
	try {
		await evalThenCaller();
		assert.fail('Expected eval then rejection');
	} catch (err) {
		assertCallerContext(err, 'evalThenCaller', /evalThenReject .*eval-then-reject\.js/, 'context.eval then reject');
	}
}

async function caseEvalImmediateReject() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	function evalImmediateCaller() {
		return context.eval('Promise.reject(new Error("eval-immediate-reject"))', {
			promise: true,
			filename: 'eval-immediate-reject.js',
		});
	}
	try {
		await evalImmediateCaller();
		assert.fail('Expected eval immediate rejection');
	} catch (err) {
		assertCallerContext(err, 'evalImmediateCaller', /eval-immediate-reject\.js/, 'context.eval immediate reject');
	}
}

async function caseScriptRunReject() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const script = isolate.compileScriptSync(
		'Promise.resolve().then(function scriptThenReject(){ throw new Error("script-then-reject"); })',
		{ filename: 'script-then-reject.js' }
	);
	function runCaller() {
		return script.run(context, { promise: true });
	}
	try {
		await runCaller();
		assert.fail('Expected script rejection');
	} catch (err) {
		assertCallerContext(err, 'runCaller', /scriptThenReject .*script-then-reject\.js/, 'script.run then reject');
	}
}

async function caseEvalClosureReject() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	function evalClosureCaller() {
		return context.evalClosure(
			'return Promise.resolve().then(function closureThenReject(){ throw new Error("closure-then-reject"); });',
			[],
			{ result: { promise: true } }
		);
	}
	try {
		await evalClosureCaller();
		assert.fail('Expected evalClosure rejection');
	} catch (err) {
		assertCallerContext(err, 'evalClosureCaller', /closureThenReject/, 'evalClosure then reject');
	}
}

async function caseReferenceApplyReject() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const ref = context.evalSync(
		'(function refReject(){ return Promise.resolve().then(function refThenReject(){ throw new Error("ref-then-reject"); }); })',
		{ reference: true }
	);
	function applyCaller() {
		return ref.apply(undefined, [], { result: { promise: true } });
	}
	try {
		await applyCaller();
		assert.fail('Expected reference.apply rejection');
	} catch (err) {
		assertCallerContext(err, 'applyCaller', /refThenReject/, 'reference.apply then reject');
	}
}

(async function() {
	await caseEvalThenReject();
	await caseEvalImmediateReject();
	await caseScriptRunReject();
	await caseEvalClosureReject();
	await caseReferenceApplyReject();
	console.log('pass');
})().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
