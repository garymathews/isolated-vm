const assert = require('assert');
const ivm = require('isolated-vm');

(async function() {
	const unhandled = [];
	const onUnhandled = (reason) => {
		unhandled.push(reason);
	};
	process.on('unhandledRejection', onUnhandled);

	const isolate = new ivm.Isolate();
	const context = isolate.createContextSync();
	const cb = new ivm.Callback(function hostCb() {
		return Promise.resolve().then(function cbReject() {
			throw new Error('callback-async-frame');
		});
	}, { async: true });
	await context.global.set('cb', cb);

	let err;
	try {
		await context.eval('cb()', { promise: true, filename: 'callback-invoke.js' });
		assert.fail('Expected callback invocation to reject');
	} catch (error) {
		err = error;
	}

	try {
		await new Promise((resolve) => setTimeout(resolve, 10));
		assert.ok(/callback-async-frame/.test(String(err && (err.message || err))), `unexpected isolate rejection: ${String(err)}`);
		assert.equal(unhandled.length, 0, `host unhandled rejection leaked: ${String(unhandled[0] && (unhandled[0].stack || unhandled[0]))}`);
		console.log('pass');
	} finally {
		process.removeListener('unhandledRejection', onUnhandled);
	}
})().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
