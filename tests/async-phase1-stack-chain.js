const assert = require('assert');
const ivm = require('isolated-vm');

async function casePreservesExistingFrames() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const fn = context.evalSync('(function passthrough(value) { return value; })', { reference: true });

	const value = {
		get x() {
			function boom() {
				throw new Error('phase1-getter');
			}
			boom();
		},
	};

	try {
		await fn.apply(undefined, [value], { arguments: { copy: true }, result: { promise: true } });
		assert.fail('Expected async apply to reject');
	} catch (err) {
		assert.ok(/phase1-getter/.test(err.message));
		assert.ok(/boom/.test(err.stack), `missing original frame:\n${err.stack}`);
		assert.ok(/get x/.test(err.stack), `missing getter frame:\n${err.stack}`);
		assert.ok(/<isolated-vm boundary>/.test(err.stack), `missing boundary frame:\n${err.stack}`);
	}
}

async function caseAttachesWhenNoExistingStack() {
	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const fn = context.evalSync('(function passthrough(value) { return value; })', { reference: true });

	const value = {
		get x() {
			throw { code: 'NO_STACK' };
		},
	};

	try {
		await fn.apply(undefined, [value], { arguments: { copy: true }, result: { promise: true } });
		assert.fail('Expected async apply to reject');
	} catch (err) {
		assert.equal(err.code, 'NO_STACK');
		assert.ok(typeof err.stack === 'string', 'expected attached stack string');
		assert.ok(/async-phase1-stack-chain\.js/.test(err.stack), `missing callsite frame:\n${err.stack}`);
	}
}

(async function() {
	await casePreservesExistingFrames();
	await caseAttachesWhenNoExistingStack();
	console.log('pass');
})().catch((err) => {
	console.error(err);
});
