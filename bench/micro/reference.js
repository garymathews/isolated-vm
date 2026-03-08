'use strict';
const ivm = require('../../isolated-vm');
const { runCase } = require('../lib');

function createEnv() {
	const isolate = new ivm.Isolate;
	const context = isolate.createContextSync();
	const jail = context.global;
	jail.setSync('hostValue', 0);
	jail.setSync('hostFn', new ivm.Reference((...args) => args.length));
	isolate.compileScriptSync(`
		globalThis.fn = function() { return 123; };
		globalThis.obj = { value: 1 };
		globalThis.callHost = function() { return hostFn.applySync(undefined, [ 1, 2, 3 ]); };
	`).runSync(context);
	return { isolate, context, jail };
}

function destroyEnv(env) {
	env.isolate.dispose();
}

runCase('reference:create Reference(object)', {
	iterations: 100,
	setup: createEnv,
	teardown: destroyEnv,
}, env => {
	for (let ii = 0; ii < 100; ++ii) {
		new ivm.Reference({});
	}
});

runCase('reference:applySync()', {
	iterations: 200,
	setup: createEnv,
	teardown: destroyEnv,
}, env => {
	const fn = env.jail.getSync('fn', { reference: true });
	for (let ii = 0; ii < 200; ++ii) {
		fn.applySync(undefined, []);
	}
});

runCase('reference:getSync()', {
	iterations: 200,
	setup: createEnv,
	teardown: destroyEnv,
}, env => {
	const obj = env.jail.getSync('obj', { reference: true });
	for (let ii = 0; ii < 200; ++ii) {
		obj.getSync('value');
	}
});

runCase('reference:setSync()', {
	iterations: 200,
	setup: createEnv,
	teardown: destroyEnv,
}, env => {
	const obj = env.jail.getSync('obj', { reference: true });
	for (let ii = 0; ii < 200; ++ii) {
		obj.setSync('value', ii);
	}
});

runCase('reference:copySync()', {
	iterations: 100,
	setup: createEnv,
	teardown: destroyEnv,
}, env => {
	const obj = env.jail.getSync('obj', { reference: true });
	for (let ii = 0; ii < 100; ++ii) {
		obj.copySync();
	}
});
