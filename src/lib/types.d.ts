declare module '*.wasm?url' {
	const content: string;
	export default content;
}

declare module '*.worker.js?url' {
	const content: string;
	export default content;
}
