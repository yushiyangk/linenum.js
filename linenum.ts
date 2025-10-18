// linenum.js
// version 0.1

// Yu Shiyang <yu.shiyang@gnayihs.uy>

// Browser compatibility: ES6
// This includes support for all current browsers with any significant market share (at least 0.1%)


const makeLinenum = (() => {
	interface MakeLinenumOptions {
		defaultStartNum: number,
		containerClassName: string | null,
		lineClassName: string | null,
		lineNumClassName: string | null,
		startNumDataAttribute: string | null,
		skipDataAttribute: string | null,  // this data attribute prevents the current line from being counted, and the line number will be incremented by the value of this attribute
	}
	const defaultMakeLinenumOptions: MakeLinenumOptions = {
		defaultStartNum: 1,
		containerClassName: "ln-container",
		lineClassName: "ln-line",
		lineNumClassName: "ln-num",
		startNumDataAttribute: "data-ln-start",
		skipDataAttribute: "data-ln-skip",
	}
	function validateMakeLinenumOptions(options: MakeLinenumOptions): boolean {
		if (options.defaultStartNum !== null && !Number.isInteger(options.defaultStartNum)) {
			throw new Error(`options.defaultStartNum must be an integer, got ${options.defaultStartNum}`);
		}
		if (options.startNumDataAttribute !== null && !options.startNumDataAttribute.startsWith("data-")) {
			throw new Error(`options.startNumDataAttribute must start with 'data-', got '${options.startNumDataAttribute}'`);
		}
		return true;
	}


	function reifyOptions<T>(options: Partial<T> | undefined, defaultOptions: T): T {
		return {
			...defaultOptions,
			...(options === undefined ? {} : options),
		};
	}

	function isElement(node: Node): node is Element {
		return node.nodeType === Node.ELEMENT_NODE;
	}

	function isTextNode(node: Node): node is Text {
		return node.nodeType === Node.TEXT_NODE;
	}

	function isDisplayBlock(displayValue: string): boolean {
		return (
			displayValue.startsWith("block")
			|| displayValue === "flex"
			|| displayValue === "grid"
			|| displayValue.startsWith("flow")  // "flow" or "flow-root"
			|| displayValue.startsWith("table")
			|| displayValue.startsWith("list")
		);
	}


	function readStartNumAttribute(element: Element, options: MakeLinenumOptions): number | null {
		if (options.startNumDataAttribute !== null) {
			const startNumAttribute = element.getAttribute(options.startNumDataAttribute);
			if (startNumAttribute !== null) {
				const startNum = parseInt(startNumAttribute, 10);
				if (!Number.isNaN(startNum)) {
					return startNum;
				}
			}
		}
		return null;
	}
	function readSkipAttribute(element: Element, options: MakeLinenumOptions): number | null {
		if (options.skipDataAttribute !== null) {
			const skipAttribute = element.getAttribute(options.skipDataAttribute);
			if (skipAttribute !== null) {
				const skip = parseInt(skipAttribute, 10);
				if (!Number.isNaN(skip)) {
					return skip;
				} else {
					return 0;
				}
			}
		}
		return null;
	}


	interface Wrapper {
		original: Element,
		idUsed: boolean,
	}

	interface Line {
		element: HTMLSpanElement,
		num: number,
		showNum: boolean,
	}

	interface CurrentLine {
		children: (Node | string)[],
		num: number,
		showNum: boolean,
	}

	function makeWrapper(wrapper: Wrapper, options: MakeLinenumOptions): Element {
		const wrapperElement = wrapper.original.cloneNode(false) as Element;
		if (wrapper.idUsed) {
			wrapperElement.removeAttribute("id");
		} else {
			wrapper.idUsed = true;
		}
		return wrapperElement;
	}

	function makeLine(
		currentLine: CurrentLine,
		wrapperStack: Wrapper[],
		options: MakeLinenumOptions,
	): Line {
		const span = document.createElement("span");
		if (options.lineClassName !== null) {
			span.classList.add(options.lineClassName);
		}

		let currentWrapper: Element = span;
		for (let i = 0; i < wrapperStack.length; i++) {
			const wrapperElement = makeWrapper(wrapperStack[i], options);
			currentWrapper.appendChild(wrapperElement);
			currentWrapper = wrapperElement;
		}

		currentWrapper.append(...currentLine.children);

		return {
			element: span,
			num: currentLine.num,
			showNum: currentLine.showNum,
		};
	}

	function traverseTextNode(
		textNode: Text,
		lines: Line[],
		currentLine: CurrentLine,
		wrapperStack: Wrapper[],
		options: MakeLinenumOptions,
	): void {
		if (textNode.nodeType !== Node.TEXT_NODE) {
			throw new Error(`not a text node: ${textNode}`);
		}

		const text = textNode.data;
		const textLines = text.split(/\r?\n|\r/);
		for (let i = 0; i < textLines.length - 1; i++) {
			const textLine = textLines[i];
			if (textLine.length === 0) {
				continue;
			}

			currentLine.children.push(textLine);
			lines.push(makeLine(currentLine, wrapperStack, options));

			// Reset currentLine
			currentLine.children.length = 0;
			currentLine.num += 1;
			currentLine.showNum = true;
		}
		// Do not make a new line for the last textLine, which may yet be incomplete
		if (textLines.length > 0) {
			currentLine.children.push(textLines[textLines.length - 1]);
		}

		return;
	}

	function traverseElement(
		element: Element,
		lines: Line[],
		currentLine: CurrentLine,
		wrapperStack: Wrapper[],
		options: MakeLinenumOptions,
	): void {
		const wrapperStartLine = lines.length;
		const wrapperStartChildIndex = currentLine.children.length;
		wrapperStack.push({ original: element, idUsed: false });

		const startNum = readStartNumAttribute(element, options);
		const skip = readSkipAttribute(element, options);
		if (skip !== null) {
			currentLine.num += skip - 1;
			currentLine.showNum = false;
			if (startNum !== null) {
				currentLine.num = startNum - 1;
			}
		} else {
			if (startNum !== null) {
				currentLine.num = startNum;
			}
		}

		traverse(element, lines, currentLine, wrapperStack, options);

		const wrappedChildren: (string | Node)[] = [];
		if (lines.length === wrapperStartLine) {
			wrappedChildren.push(...currentLine.children.slice(wrapperStartChildIndex));
		} else if (lines.length > wrapperStartLine) {
			// The earlier lines have already been wrapped, so we only need to wrap from the start of the current line
			wrappedChildren.push(...currentLine.children);
		} else {
			throw new Error(`line count decreased after traversing element: ${element}`);
		}
		if (wrappedChildren.length > 0) {
			const wrapperElement = makeWrapper(wrapperStack[wrapperStack.length - 1], options);
			wrapperElement.append(...wrappedChildren);
			currentLine.children.length -= wrappedChildren.length;
			currentLine.children.push(wrapperElement);
		}

		wrapperStack.pop();
	}

	function traverse(
		container: Element,
		lines: Line[],
		currentLine: CurrentLine,
		wrapperStack: Wrapper[],
		options: MakeLinenumOptions,
	): void {
		const childNodes = container.childNodes;
		for (const child of childNodes) {
			let childIsBlockElement = false;
			if (isElement(child)) {
				const childElementDisplay = window.getComputedStyle(child).display;

				if (childElementDisplay === "none") {
					console.warn("linenum.js:traverse: child element 'display' style is set to 'none', will be omitted from output:", child);
					continue;

				} else if (childElementDisplay === "content") {
					console.error("linenum.js:traverse: child element 'display' style must not be set to 'content', skipping:", child);
					continue;

				} else {
					childIsBlockElement = isDisplayBlock(childElementDisplay);
				}
			}

			if (childIsBlockElement) {
				console.error("linenum.js:traverse: child element must not be a block element, skipping: ", child);
				continue;

			} else if (isElement(child)) {
				traverseElement(child, lines, currentLine, wrapperStack, options);

			} else if (isTextNode(child)) {
				traverseTextNode(child, lines, currentLine, wrapperStack, options);

			} else {
				console.warn("linenum.js:traverse: child is not an element or a text node, will be omitted output", child);
				continue
			}
		}
	}


	function makeLines(container: Element, options: MakeLinenumOptions): Line[] | null {
		const containerComputedStyle = window.getComputedStyle(container);
		const containerIsPreformatted = containerComputedStyle.whiteSpace.startsWith("pre") || containerComputedStyle.whiteSpaceCollapse === "preserve";
		if (!containerIsPreformatted) {
			console.warn("linenum.js:makeLines: container 'white-space' style must be set to preformatted:", container);
			return null;
		}

		const containerIsBlock = isDisplayBlock(containerComputedStyle.display);
		if (!containerIsBlock) {
			console.warn("linenum.js:makeLines: container must be a block element:", container);
			return null;
		}

		const lines: Line[] = [];
		const lineWrapperStack: Wrapper[] = [];
		const currentLine: CurrentLine = {
			children: [],
			showNum: true,
			num: readStartNumAttribute(container, options) ?? options.defaultStartNum,
		};

		traverse(container, lines, currentLine, lineWrapperStack, options);
		if (currentLine.children.length > 0) {
			lines.push(makeLine(currentLine, lineWrapperStack, options));
		}

		return lines;
	}

	function convertContainer(container: Element, options: MakeLinenumOptions): void {
		if (options.containerClassName !== null) {
			container.classList.add(options.containerClassName);
		}
	}

	function populateContainer(container: Element, lines: Line[], options: MakeLinenumOptions): void {
		container.innerHTML = "";

		const elements = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			const numElement = document.createElement("span");
			if (options.lineNumClassName !== null) {
				numElement.classList.add(options.lineNumClassName);
			}
			if (line.showNum) {
				numElement.append(line.num.toString());
			}

			elements.push(numElement, line.element)
		}

		container.append(...elements);
	}

	return (preformattedElements: Element[], options?: MakeLinenumOptions) => {
		const reifiedOptions = reifyOptions(options, defaultMakeLinenumOptions);
		validateMakeLinenumOptions(reifiedOptions);

		for (const container of preformattedElements) {
			const lines = makeLines(container, reifiedOptions);
			if (lines === null) {
				console.error("linenum.js: failed to make lines for container, skipping:", container)
				continue;
			}

			convertContainer(container, reifiedOptions);
			populateContainer(container, lines, reifiedOptions);
		}
	}
})();
