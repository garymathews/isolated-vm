'use strict';

function formatNumber(value) {
	return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatDurationNs(ns) {
	if (ns >= 1e9) {
		return `${formatNumber(ns / 1e9)} s`;
	}
	if (ns >= 1e6) {
		return `${formatNumber(ns / 1e6)} ms`;
	}
	if (ns >= 1e3) {
		return `${formatNumber(ns / 1e3)} us`;
	}
	return `${formatNumber(ns)} ns`;
}

function summarize(samples) {
	const sorted = [...samples].sort((left, right) => left - right);
	const total = sorted.reduce((sum, value) => sum + value, 0);
	const median = sorted[Math.floor(sorted.length / 2)];
	const mean = total / sorted.length;
	return { median, mean };
}

function runCase(name, options, fn) {
	const {
		warmup = 5,
		runs = 15,
		iterations = 1,
		setup,
		teardown,
	} = options;

	for (let ii = 0; ii < warmup; ++ii) {
		const state = setup ? setup() : undefined;
		fn(state);
		if (teardown) {
			teardown(state);
		}
	}

	const samples = [];
	for (let ii = 0; ii < runs; ++ii) {
		const state = setup ? setup() : undefined;
		const start = process.hrtime.bigint();
		fn(state);
		const elapsed = Number(process.hrtime.bigint() - start);
		if (teardown) {
			teardown(state);
		}
		samples.push(elapsed / iterations);
	}

	const { median, mean } = summarize(samples);
	const opsPerSec = 1e9 / median;
	console.log(`${name}: median ${formatDurationNs(median)} | mean ${formatDurationNs(mean)} | ${formatNumber(opsPerSec)} ops/s`);
}

module.exports = {
	runCase,
};
