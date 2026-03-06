const assert = require('assert');
const ivm = require('isolated-vm');

async function getAsyncError(fn) {
	try {
		await fn();
		assert.fail('Expected promise rejection');
	} catch (err) {
		return err;
	}
}

function assertFrame(stack, pattern, label) {
	const line = stack.split('\n').find((entry) => pattern.test(entry));
	assert.ok(line, `missing stack frame for ${label}`);
	assert.ok(/:\d+:\d+\)?$/.test(line), `missing line/column in frame: ${line}`);
}

async function caseScriptRun() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const script = isolate.compileScriptSync(
		'Promise.resolve().then(function failScriptRun() { throw new Error("script-run-depth"); });',
		{ filename: 'script-run-depth.js' }
	);
	const err = await getAsyncError(() => script.run(context, { promise: true }));
	assert.ok(/script-run-depth/.test(err.message));
	assertFrame(err.stack, /failScriptRun .*script-run-depth\.js/, 'script.run function frame');
}

async function caseContextEval() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const err = await getAsyncError(() => context.eval(
		'Promise.resolve().then(function failEval() { throw new Error("context-eval-depth"); });',
		{ filename: 'context-eval-depth.js', promise: true }
	));
	assert.ok(/context-eval-depth/.test(err.message));
	assertFrame(err.stack, /failEval .*context-eval-depth\.js/, 'context.eval function frame');
}

async function caseModuleEvaluate() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const modules = {
		'./a.js': isolate.compileModuleSync(
			"import { fromB } from './b.js'; Promise.resolve().then(() => fromB());",
			{ filename: 'a-depth.js' }
		),
		'./b.js': isolate.compileModuleSync(
			"export function fromB() { return Promise.resolve().then(function failModuleEval() { throw new Error('module-eval-depth'); }); }",
			{ filename: 'b-depth.js' }
		),
	};
	await modules['./a.js'].instantiate(context, specifier => modules[specifier]);
	const err = await getAsyncError(() => modules['./a.js'].evaluate());
	assert.ok(/module-eval-depth/.test(err.message));
	assert.ok(err.stack.includes('<isolated-vm boundary>'));
	assertFrame(err.stack, /failModuleEval .*b-depth\.js/, 'module frame');
}

async function caseReferenceApply() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const fn = context.evalSync(
		"(function referenceTarget() { return Promise.resolve().then(function failRefApply() { throw new Error('reference-apply-depth'); }); })",
		{ reference: true }
	);
	const err = await getAsyncError(() => fn.apply(undefined, [], { result: { promise: true } }));
	assert.ok(/reference-apply-depth/.test(err.message));
	assertFrame(err.stack, /failRefApply .*<isolated-vm>/, 'reference.apply frame');
}

(async function() {
	await caseScriptRun();
	await caseContextEval();
	await caseModuleEvaluate();
	await caseReferenceApply();
	console.log('pass');
})().catch((err) => {
	console.error(err);
});
