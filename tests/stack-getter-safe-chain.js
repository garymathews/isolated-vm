const assert = require('assert');
const ivm = require('isolated-vm');

(async function() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const fn = context.evalSync('(function passthrough(value) { return value; })', { reference: true });

	const value = {
		get x() {
			const err = new Error('original-error');
			Object.defineProperty(err, 'stack', {
				get() {
					throw new Error('stack-getter-denied');
				},
			});
			throw err;
		},
	};

	let err;
	try {
		await fn.apply(undefined, [value], { arguments: { copy: true }, result: { promise: true } });
		assert.fail('Expected rejection');
	} catch (error) {
		err = error;
	}

	assert.equal(err && err.message, 'original-error');
	assert.ok(!/stack-getter-denied/.test(String(err && err.message)));
	console.log('pass');
})().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
