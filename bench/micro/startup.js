'use strict';
const ivm = require('../../isolated-vm');
const { runCase } = require('../lib');

const smallSource = 'globalThis.value = 1;';
const largeSource = Array(20000).fill().map((_, ii) => `function fn${ii}(){return ${ii};}`).join('\n');

runCase('startup:new Isolate()', {
	iterations: 25,
	setup: () => [],
	teardown: isolates => {
		for (const isolate of isolates) {
			isolate.dispose();
		}
	},
}, isolates => {
	for (let ii = 0; ii < 25; ++ii) {
		isolates.push(new ivm.Isolate);
	}
});

runCase('startup:createContextSync()', {
	iterations: 25,
	setup: () => {
		const isolate = new ivm.Isolate;
		return { isolate, contexts: [] };
	},
	teardown: ({ isolate }) => isolate.dispose(),
}, state => {
	for (let ii = 0; ii < 25; ++ii) {
		state.contexts.push(state.isolate.createContextSync());
	}
});

runCase('startup:compileScriptSync(small)', {
	iterations: 10,
	setup: () => new ivm.Isolate,
	teardown: isolate => isolate.dispose(),
}, isolate => {
	for (let ii = 0; ii < 10; ++ii) {
		isolate.compileScriptSync(smallSource);
	}
});

runCase('startup:compileScriptSync(large)', {
	setup: () => new ivm.Isolate,
	teardown: isolate => isolate.dispose(),
}, isolate => {
	isolate.compileScriptSync(largeSource);
});

const cachedData = (() => {
	const isolate = new ivm.Isolate;
	try {
		return isolate.compileScriptSync(largeSource, { produceCachedData: true }).cachedData;
	} finally {
		isolate.dispose();
	}
})();

runCase('startup:compileScriptSync(large cachedData)', {
	setup: () => new ivm.Isolate,
	teardown: isolate => isolate.dispose(),
}, isolate => {
	isolate.compileScriptSync(largeSource, { cachedData });
});
