const assert = require('assert');
const ivm = require('isolated-vm');

function runCreateSnapshot() {
	ivm.Isolate.createSnapshot([{
		code: 'function snapInner(){ throw new Error("snap-missing-frame"); } snapInner();',
		filename: 'snap-inner.js',
	}]);
}

try {
	runCreateSnapshot();
	assert.fail('Expected createSnapshot to throw');
} catch (err) {
	const stack = String(err && err.stack);
	assert.ok(/snap-missing-frame/.test(String(err && err.message)));
	assert.ok(/<isolated-vm boundary>/.test(stack), `missing boundary frame:\n${stack}`);
	assert.ok(/runCreateSnapshot/.test(stack), `missing outer caller frame:\n${stack}`);
	console.log('pass');
}
