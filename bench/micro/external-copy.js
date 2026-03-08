'use strict';
const ivm = require('../../isolated-vm');
const { runCase } = require('../lib');

const objectValue = { a: 1, b: 'value', c: [1, 2, 3], d: { nested: true } };
const typed64k = new Uint8Array(64 * 1024);
const typed1m = new Uint8Array(1024 * 1024);
const typed16m = new Uint8Array(16 * 1024 * 1024);

runCase('external-copy:primitive number', {
	iterations: 1000,
}, () => {
	for (let ii = 0; ii < 1000; ++ii) {
		new ivm.ExternalCopy(123).copyInto();
	}
});

runCase('external-copy:string', {
	iterations: 200,
}, () => {
	for (let ii = 0; ii < 200; ++ii) {
		new ivm.ExternalCopy('x'.repeat(256)).copyInto();
	}
});

runCase('external-copy:object', {
	iterations: 50,
}, () => {
	for (let ii = 0; ii < 50; ++ii) {
		new ivm.ExternalCopy(objectValue).copyInto();
	}
});

for (const [name, value] of [
	['64KB', typed64k],
	['1MB', typed1m],
	['16MB', typed16m],
]) {
	runCase(`external-copy:typed-array copy ${name}`, {
		iterations: 10,
	}, () => {
		for (let ii = 0; ii < 10; ++ii) {
			new ivm.ExternalCopy(value).copyInto();
		}
	});

	runCase(`external-copy:typed-array transfer ${name}`, {
		iterations: 10,
		setup: () => Array.from({ length: 10 }, () => new Uint8Array(value.byteLength)),
	}, arrays => {
		for (const array of arrays) {
			new ivm.ExternalCopy(array, { transferOut: true }).copyInto({ transferIn: true });
		}
	});
}

runCase('external-copy:transferList view', {
	iterations: 50,
	setup: () => Array.from({ length: 50 }, () => new Uint8Array(64 * 1024)),
}, arrays => {
	for (const array of arrays) {
		new ivm.ExternalCopy(array, { transferList: [ array.buffer ] }).copyInto();
	}
});
