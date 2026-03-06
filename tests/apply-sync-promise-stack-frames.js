const assert = require('assert');
const ivm = require('isolated-vm');

(async function() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	context.global.setSync('rejector', new ivm.Reference(function rejector() {
		function hostInner() {
			throw new Error('host-inner-reject');
		}
		return Promise.resolve().then(hostInner);
	}));

	const script = isolate.compileScriptSync(`
		function runReject() {
			return rejector.applySyncPromise(undefined, []);
		}
		runReject();
	`, { filename: 'inner-apply-sync-promise-reject.js' });

	let err;
	try {
		await script.run(context, { promise: true });
		assert.fail('Expected rejection');
	} catch (error) {
		err = error;
	}

	const stack = String(err && err.stack);
	assert.ok(/hostInner/.test(stack), `missing origin frame:\n${stack}`);
	assert.ok(
		/runReject/.test(stack) || /inner-apply-sync-promise-reject\.js/.test(stack),
		`missing isolate callsite frame in stack:\n${stack}`
	);
	assert.ok(/<isolated-vm boundary>/.test(stack), `missing boundary frame:\n${stack}`);
	console.log('pass');
})().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
