'use strict';

const addon = require('./out/isolated_vm');
let ivm;
const LAZY_TARGET = '__ivm_target__';

function load() {
	if (ivm === undefined) {
		ivm = addon.ivm;
	}
	return ivm;
}

module.exports = new Proxy({}, {
	get(_target, property, receiver) {
		if (property === LAZY_TARGET) {
			return load();
		}
		return Reflect.get(load(), property, receiver);
	},
	set(_target, property, value, receiver) {
		return Reflect.set(load(), property, value, receiver);
	},
	getPrototypeOf() {
		return Reflect.getPrototypeOf(load());
	},
	setPrototypeOf(_target, prototype) {
		return Reflect.setPrototypeOf(load(), prototype);
	},
	has(_target, property) {
		return Reflect.has(load(), property);
	},
	ownKeys() {
		return Reflect.ownKeys(load());
	},
	getOwnPropertyDescriptor(_target, property) {
		const descriptor = Reflect.getOwnPropertyDescriptor(load(), property);
		if (descriptor && descriptor.configurable === false) {
			return { ...descriptor, configurable: true };
		}
		return descriptor;
	},
	defineProperty(_target, property, descriptor) {
		return Reflect.defineProperty(load(), property, descriptor);
	},
	deleteProperty(_target, property) {
		return Reflect.deleteProperty(load(), property);
	},
});
