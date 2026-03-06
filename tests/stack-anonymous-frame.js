const assert = require('assert');
const ivm = require('isolated-vm');

const isolateInner = new ivm.Isolate();
const contextInner = isolateInner.createContextSync();
const scriptInner = isolateInner.compileScriptSync(`
	function leaf() { throw new Error('anon-mid-stack'); }
	function afterAnonymous() { return leaf(); }
	function triggerAnonymous() { return (function() { return afterAnonymous(); })(); }
	function outerMost() { return triggerAnonymous(); }
	outerMost();
`);

const isolateOuter = new ivm.Isolate();
const contextOuter = isolateOuter.createContextSync();
contextOuter.global.setSync('nextScript', scriptInner);
contextOuter.global.setSync('nextContext', contextInner);
const scriptOuter = isolateOuter.compileScriptSync(`
	function bridge() { nextScript.runSync(nextContext); }
	bridge();
`);

try {
	scriptOuter.runSync(contextOuter);
	assert.fail('Expected throw');
} catch (err) {
	assert.ok(/anon-mid-stack/.test(err.message));
	assert.ok(err.stack.includes('triggerAnonymous'), `missing frame beyond anonymous frame:\n${err.stack}`);
	assert.ok(err.stack.includes('outerMost'), `missing deeper frame beyond anonymous frame:\n${err.stack}`);
}

console.log('pass');
