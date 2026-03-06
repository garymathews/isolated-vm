const assert = require('assert');
const ivm = require('isolated-vm');

const isolate = new ivm.Isolate();
const context = isolate.createContextSync();

let firstMessage = '';
try {
	context.evalSync(`
		Promise.reject(new Error('first-unhandled'));
		Promise.reject(new Error('second-unhandled'));
		0;
	`);
	assert.fail('Expected first unhandled rejection');
} catch (err) {
	firstMessage = String(err.message);
	assert.ok(
		firstMessage.includes('first-unhandled') || firstMessage.includes('second-unhandled'),
		`unexpected first rejection: ${firstMessage}`
	);
}

const secondExpected = firstMessage.includes('first-unhandled') ? 'second-unhandled' : 'first-unhandled';
assert.throws(
	() => context.evalSync('1 + 1'),
	new RegExp(secondExpected)
);

console.log('pass');
