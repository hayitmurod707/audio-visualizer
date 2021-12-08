class ScalableHeightElement {
	#element;
	#maxHeightPx;
	constructor(element, maxHeightPx) {
		this.#maxHeightPx = maxHeightPx;
		this.#element = element;
	}
	set height(newValue) {
		this.#element.style.height = `${newValue * this.#maxHeightPx}px`;
	}
}
class SampleConsumer {
	#bars;
	#samples;
	constructor(bars) {
		this.#bars = bars;
		this.#samples = new Array(bars.length).fill(0);
	}
	consumeSample(value) {
		this.#samples.shift();
		this.#samples.push(value);
		this.#samples.forEach((value, index) => (this.#bars[index].height = value));
	}
}
class SampleProducer {
	#audio;
	#context;
	#consumer;
	#sampleIntervalMs;
	#delayMs;
	#audioNode;
	#delayNode;
	#analyserNode;
	#dataArray;
	#previousSampleProducedAt = 0;
	constructor(audio, consumer, { sampleIntervalMs, delayMs = 0.1 }) {
		this.#audio = audio;
		this.#consumer = consumer;
		this.#sampleIntervalMs = sampleIntervalMs;
		this.#delayMs = delayMs;
		this.#audio.addEventListener('play', () => this.#initialize(), {
			once: true,
		});
	}
	#createNodes() {
		this.#context = new AudioContext();
		this.#audioNode = this.#context.createMediaElementSource(this.#audio);
		this.#analyserNode = this.#context.createAnalyser();
		const delaySeconds = this.#delayMs / 1000;
		this.#delayNode = this.#context.createDelay(delaySeconds);
		this.#delayNode.delayTime.value = delaySeconds;
		this.#analyserNode.fftSize = 4096;
		this.#dataArray = new Float32Array(this.#analyserNode.fftSize);
	}
	#connectNodes() {
		this.#audioNode.connect(this.#analyserNode);
		this.#analyserNode.connect(this.#delayNode);
		this.#delayNode.connect(this.#context.destination);
	}
	#initialize() {
		this.#createNodes();
		this.#connectNodes();
		this.#scheduleTick();
	}
	#scheduleTick() {
		requestAnimationFrame(timestamp => this.#tick(timestamp));
	}
	#tick(currentTimestamp) {
		this.#scheduleTick();
		if (this.#previousSampleProducedAt == 0) {
			this.#previousSampleProducedAt = currentTimestamp;
			return;
		}
		const timeElapsed = currentTimestamp - this.#previousSampleProducedAt;
		this.#analyserNode.getFloatTimeDomainData(this.#dataArray);
		const sampleValue = this.#getOverallAmplitude(this.#dataArray);
		const sampleCount = Math.floor(timeElapsed / this.#sampleIntervalMs);
		this.#previousSampleProducedAt += sampleCount * this.#sampleIntervalMs;
		for (let i = 0; i < sampleCount; i++) {
			this.#consumer.consumeSample(sampleValue);
		}
	}
	#getOverallAmplitude(array) {
		return array.reduce((acc, e) => acc + Math.abs(e)) / array.length;
	}
}
const MAX_BAR_HEIGHT_PX = 100;
const bars = [...document.querySelectorAll('.audio-equalizer')].map(
	e => new ScalableHeightElement(e, MAX_BAR_HEIGHT_PX),
);
const songTempoBpm = 150;
const beatIntervalMs = (60 * 1000) / songTempoBpm;
const sampleIntervalMs = beatIntervalMs / bars.length;
const sampleConsumer = new SampleConsumer(bars);
const audio = document.getElementById('audio');
const sampleProducer = new SampleProducer(audio, sampleConsumer, {
	sampleIntervalMs,
	delayMs: beatIntervalMs,
});
