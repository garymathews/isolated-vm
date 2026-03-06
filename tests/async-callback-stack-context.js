const assert = require('assert');
const ivm = require('isolated-vm');

(async function() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();

	context.global.setSync('hostCallback', new ivm.Callback(function hostCallback() {
		return Promise.resolve().then(function callbackOrigin() {
			throw new Error('callback-stack-context');
		});
	}, { async: true }));

	try {
		await context.eval('hostCallback()', { promise: true, filename: 'callback-context.js' });
		assert.fail('Expected callback rejection');
	} catch (err) {
		const stack = String(err && err.stack);
		assert.ok(/callbackOrigin/.test(stack), `missing callback origin frame:\n${stack}`);
		assert.ok(/<isolated-vm boundary>/.test(stack), `missing boundary frame:\n${stack}`);
		assert.ok(/callback-context\.js/.test(stack), `missing isolate caller context:\n${stack}`);
		assert.ok(!/\(<isolated-vm boundary>\)\n    at \(\<isolated-vm boundary>\)/.test(stack), `found duplicate adjacent boundaries:\n${stack}`);
	}

	console.log('pass');
})().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
