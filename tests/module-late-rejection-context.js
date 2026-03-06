const assert = require('assert');
const ivm = require('isolated-vm');

(async function() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();

	context.global.setSync('lateReject', new ivm.Callback(function lateReject() {
		return new Promise((_, reject) => {
			setImmediate(() => {
				reject(new Error('late-module-reject'));
			});
		});
	}, { async: true }));

	const moduleHandle = isolate.compileModuleSync(
		'lateReject(); export const marker = 1;',
		{ filename: 'late-module.js' }
	);
	await moduleHandle.instantiate(context, () => {
		throw new Error('unexpected import');
	});

	// Evaluation succeeds because the rejection happens after the module body returns.
	await moduleHandle.evaluate();
	await new Promise((resolve) => setTimeout(resolve, 20));

	try {
		await context.eval('1', { promise: true });
		assert.fail('Expected deferred rejection on follow-up call');
	} catch (err) {
		const stack = String(err && err.stack);
		assert.ok(/late-module\.js/.test(stack), `missing module filename frame:\n${stack}`);
		assert.ok(/<module>/.test(stack), `missing module context frame:\n${stack}`);
	}

	console.log('pass');
})().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
