// linenum.js
// version 0.3

// Yu Shiyang <yu.shiyang@gnayihs.uy>

// Browser compatibility: ES6
// This includes support for all current browsers with any significant market share (at least 0.1%)


const makeLinenum = (() => {
	interface MakeLinenumOptions {
		defaultStartNum: number,
		containerClassName: string,
		lineClassName: string,
		lineNumClassName: string,
		insertedLineClassName: string,
		deletedLineClassName: string,
		startNumDataAttribute: string,
		skipDataAttribute: string,  // this data attribute prevents the current line from being counted, and the line number will be incremented by the value of this attribute

		// for diffs
		diffContainerClassName: string,
		lineDiffNumClassName: string,
		origNumDataAttribute: string,  // if this data attribute is not given, defaults to the same value as startNumDataAttribute
		// these data attributes specifies the number of lines, including this one, to be treated as a diff
		insertedLinesCountDataAttribute: string,
		deletedLinesCountDataAttribute: string,  // deleted lines do not count towards the main line numbering
	}
	const defaultMakeLinenumOptions: MakeLinenumOptions = {
		defaultStartNum: 1,
		containerClassName: "ln-container",
		lineClassName: "ln-line",
		lineNumClassName: "ln-num",
		insertedLineClassName: "ln-ins",
		deletedLineClassName: "ln-del",
		startNumDataAttribute: "data-ln-start",
		skipDataAttribute: "data-ln-skip",
		diffContainerClassName: "ln-diff",
		lineDiffNumClassName: "ln-dnum",
		origNumDataAttribute: "data-ln-orig",
		insertedLinesCountDataAttribute: "data-ln-ins",
		deletedLinesCountDataAttribute: "data-ln-del",
	}
	function validateMakeLinenumOptions(options: MakeLinenumOptions): boolean {
		if (!Number.isInteger(options.defaultStartNum)) {
			throw new Error(`options.defaultStartNum must be an integer, got ${options.defaultStartNum}`);
		}
		type MakeLinenumOptionsStringKey = {
			[K in keyof MakeLinenumOptions]: MakeLinenumOptions[K] extends string ? K : never
		}[keyof MakeLinenumOptions];
		for (const dataAttributeKey of [
			"startNumDataAttribute",
			"skipDataAttribute",
			"origNumDataAttribute",
			"insertedLinesCountDataAttribute",
			"deletedLinesCountDataAttribute",
		] as MakeLinenumOptionsStringKey[]) {
			const dataAttribute = options[dataAttributeKey];
			if (!dataAttribute.startsWith("data-")) {
				throw new Error(`options.${dataAttributeKey} must start with 'data-', got '${dataAttribute}'`);
			}
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


	function getBaseStyle(options: MakeLinenumOptions): string {
		return (
			`:root {
	--ln-num-colour: slategrey;
	--ln-num-background: ghostwhite;
	--ln-line-colour: inherit;
	--ln-line-background: inherit;
	--ln-insertion-background: lightgreen;
	--ln-deletion-background: lightsalmon;
	--ln-margin-before: 0;
	--ln-margin-after: 0;
	--ln-margin-vertical: 0;
	--ln-padding-before: 0;
	--ln-padding-after: 0;
	--ln-padding-vertical: 0;

	--ln-num-spacing: 1em;
}

.${options.containerClassName} {
	display: grid;
	grid-template-columns: [num] auto [line] 1fr [end];
	grid-auto-flow: column;
	grid-gap: 0 var(--ln-num-spacing) ;
	justify-items: stretch;
	align-items: stretch;
}
.${options.containerClassName}.${options.diffContainerClassName} {
	grid-template-columns: [diff] auto [num] auto [line] 1fr [end];
}

.${options.lineNumClassName}, .${options.lineDiffNumClassName} {
	display: block;

	margin-left: var(--ln-margin-before);
	margin-inline-start: var(--ln-margin-before);
	margin-right: var(--ln-margin-after);
	margin-inline-end: var(--ln-margin-after);
	margin-top: var(--ln-margin-vertical);
	margin-bottom: var(--ln-margin-vertical);
	padding-left: var(--ln-padding-before);
	padding-inline-start: var(--ln-padding-before);
	padding-right: var(--ln-padding-after);
	padding-inline-end: var(--ln-padding-after);
	padding-top: var(--ln-padding-vertical);
	padding-bottom: var(--ln-padding-vertical);

	color: var(--ln-num-colour);
	background-color: var(--ln-num-background);

	text-align: right;

	user-select: none;
}
.${options.lineDiffNumClassName} {
	grid-column: diff;
}
.${options.lineNumClassName} {
	grid-column: num;
}

.${options.lineClassName} {
	display: block;

	grid-column: line;

	color: var(--ln-line-colour);
	background-color: var(--ln-line-background);
}
.${options.lineClassName}.${options.insertedLineClassName} {
	background-color: var(--ln-insertion-background);
}
.${options.lineClassName}.${options.deletedLineClassName} {
	background-color: var(--ln-deletion-background);
}
`
		);
	}


	function readIntAttribute(element: Element, attributeName: string, defaultValue: number | null = null) {
		const value = element.getAttribute(attributeName);
		if (value !== null) {
			const intValue = parseInt(value, 10);
			if (!Number.isNaN(intValue)) {
				return intValue;
			} else {
				return defaultValue;
			}
		}
		return null;
	}

	enum DiffLineType {
		Insertion = 1,
		Deletion = 2,
	}

	interface Wrapper {
		original: Element,
		startScanLine: number,
		startScanChildIndex: number,
		idUsed: boolean,
	}

	interface Line {
		element: HTMLSpanElement,
		num: number,
		showNum: boolean,
		diff: DiffLineType | null,
	}

	class LineArray extends Array<Line> {
		hasDiff = false;
	}

	interface ScanLine {
		children: (Node | string)[],
		num: number,
		origNum: number,
		showNum: boolean,
		diffLinesCount: number,
		diff: DiffLineType | null,
	}

	function advanceCurrentScanLine(currentScanLine: ScanLine): void {
		currentScanLine.children.length = 0;

		if (currentScanLine.diff === DiffLineType.Insertion && currentScanLine.diffLinesCount > 0) {
			currentScanLine.num += 1;
		} else if (currentScanLine.diff === DiffLineType.Deletion && currentScanLine.diffLinesCount > 0) {
			currentScanLine.origNum += 1;
		} else {
			currentScanLine.num += 1;
			currentScanLine.origNum += 1;
		}

		currentScanLine.showNum = true;

		currentScanLine.diffLinesCount -= 1;
		if (currentScanLine.diffLinesCount <= 0) {
			currentScanLine.diffLinesCount = 0;
			currentScanLine.diff = null;
		}
	}

	function makeWrapperElement(wrapper: Wrapper, options: MakeLinenumOptions): Element {
		const wrapperElement = wrapper.original.cloneNode(false) as Element;
		if (wrapper.idUsed) {
			wrapperElement.removeAttribute("id");
		} else {
			wrapper.idUsed = true;
		}
		return wrapperElement;
	}

	function addLine(
		lines: LineArray,
		currentScanLine: ScanLine,
		wrapperStack: Wrapper[],
		options: MakeLinenumOptions,
	): void {
		const span = document.createElement("span");
		span.classList.add(options.lineClassName);

		let currentWrapper: Element = span;
		let currentScanChildIndex = 0;
		for (let i = 0; i < wrapperStack.length; i++) {
			const wrapper = wrapperStack[i];
			const wrapperElement = makeWrapperElement(wrapperStack[i], options);
			if (wrapper.startScanLine > lines.length) {
				throw new Error(`wrapper started on a scan line below the current line: ${wrapper}`);
			} else if (wrapper.startScanLine === lines.length) {
				// Wrapper started on the current line
				// First add the elements encountered before the current wrapper
				currentWrapper.append(...currentScanLine.children.slice(currentScanChildIndex, wrapper.startScanChildIndex));
				currentScanChildIndex = wrapper.startScanChildIndex;
			}
			currentWrapper.appendChild(wrapperElement);
			currentWrapper = wrapperElement;
		}

		currentWrapper.append(...currentScanLine.children.slice(currentScanChildIndex));

		const line = {
			element: span,
			num: currentScanLine.diffLinesCount > 0 && currentScanLine.diff === DiffLineType.Deletion ? currentScanLine.origNum : currentScanLine.num,
			showNum: currentScanLine.showNum,
			diff: currentScanLine.diffLinesCount > 0 ? currentScanLine.diff : null,
		};
		lines.push(line);
		if (line.diff !== null) {
			lines.hasDiff = true;
		}

		advanceCurrentScanLine(currentScanLine);
	}

	function traverseTextNode(
		textNode: Text,
		lines: LineArray,
		currentScanLine: ScanLine,
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

			currentScanLine.children.push(textLine);
			addLine(lines,currentScanLine, wrapperStack, options);
		}
		// Do not make a new line for the last textLine, which may yet be incomplete
		if (textLines.length > 0) {
			const textLinePart = textLines[textLines.length - 1];
			if (textLinePart.length > 0) {
				currentScanLine.children.push(textLines[textLines.length - 1]);
			}
		}

		return;
	}

	function traverseElement(
		element: Element,
		lines: LineArray,
		currentScanLine: ScanLine,
		wrapperStack: Wrapper[],
		options: MakeLinenumOptions,
	): void {
		const elementStartScanLine = lines.length;
		const elementStartScanChildIndex = currentScanLine.children.length;
		wrapperStack.push({
			original: element,
			startScanLine: elementStartScanLine,
			startScanChildIndex: elementStartScanChildIndex,
			idUsed: false,
		});

		const startNum = readIntAttribute(element, options.startNumDataAttribute);
		const skip = readIntAttribute(element, options.skipDataAttribute, 0);
		const originalStartNum = readIntAttribute(element, options.origNumDataAttribute);
		let insertedLinesCount = readIntAttribute(element, options.insertedLinesCountDataAttribute);
		let deletedLinesCount = readIntAttribute(element, options.deletedLinesCountDataAttribute);

		if (insertedLinesCount !== null && deletedLinesCount !== null) {
			console.warn(`linenum.js:traverseElement: ${options.insertedLinesCountDataAttribute} and ${options.deletedLinesCountDataAttribute} attributes cannot both be set, ignoring both:`, element);
			insertedLinesCount = null;
			deletedLinesCount = null;
		}

		if (skip !== null) {
			currentScanLine.showNum = false;
			if (startNum !== null) {
				currentScanLine.num = startNum - 1;
			} else {
				currentScanLine.num += skip - 1;
			}
			if (originalStartNum !== null) {
				currentScanLine.origNum = originalStartNum - 1;
			} else if (currentScanLine.origNum !== undefined) {
				currentScanLine.origNum += skip - 1;
			}
			if (insertedLinesCount !== null) {
				currentScanLine.diffLinesCount = insertedLinesCount - skip + 1;
				currentScanLine.diff = DiffLineType.Insertion;
			} else if (deletedLinesCount !== null) {
				currentScanLine.diffLinesCount = deletedLinesCount - skip + 1;
				currentScanLine.diff = DiffLineType.Deletion;
			}
		} else {
			if (startNum !== null) {
				currentScanLine.num = startNum;
			}
			if (originalStartNum !== null) {
				currentScanLine.origNum = originalStartNum;
			}
			if (insertedLinesCount !== null) {
				currentScanLine.diffLinesCount = insertedLinesCount;
				currentScanLine.diff = DiffLineType.Insertion;
			} else if (deletedLinesCount !== null) {
				currentScanLine.diffLinesCount = deletedLinesCount;
				currentScanLine.diff = DiffLineType.Deletion;
			}
		}

		traverse(element, lines, currentScanLine, wrapperStack, options);

		const wrappedChildren: (string | Node)[] = [];
		if (lines.length === elementStartScanLine) {
			wrappedChildren.push(...currentScanLine.children.slice(elementStartScanChildIndex));
		} else if (lines.length > elementStartScanLine) {
			// The earlier lines have already been wrapped, so we only need to wrap from the start of the current line
			wrappedChildren.push(...currentScanLine.children);
		} else {
			throw new Error(`line count decreased after traversing element: ${element}`);
		}
		if (wrappedChildren.length > 0) {
			const wrapperElement = makeWrapperElement(wrapperStack[wrapperStack.length - 1], options);
			wrapperElement.append(...wrappedChildren);
			currentScanLine.children.length -= wrappedChildren.length;
			currentScanLine.children.push(wrapperElement);
		}

		wrapperStack.pop();
	}

	function traverse(
		container: Element,
		lines: LineArray,
		currentLine: ScanLine,
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


	function makeLines(container: Element, options: MakeLinenumOptions): LineArray | null {
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

		const lines: LineArray = new LineArray();
		const lineWrapperStack: Wrapper[] = [];
		const startNum = readIntAttribute(container, options.startNumDataAttribute) ?? options.defaultStartNum;
		const currentScanLine: ScanLine = {
			children: [],
			showNum: true,
			num: startNum,
			origNum: readIntAttribute(container, options.origNumDataAttribute) ?? startNum,
			diffLinesCount: 0,
			diff: null,
		};

		traverse(container, lines, currentScanLine, lineWrapperStack, options);
		if (currentScanLine.children.length > 0) {
			addLine(lines, currentScanLine, lineWrapperStack, options);
		}

		return lines;
	}

	function convertContainer(container: Element, hasDiff: boolean, options: MakeLinenumOptions): void {
		container.classList.add(options.containerClassName);
		if (hasDiff) {
			container.classList.add(options.diffContainerClassName);
		}
	}

	function populateContainer(container: Element, lines: LineArray, options: MakeLinenumOptions): void {
		convertContainer(container, lines.hasDiff, options);

		container.innerHTML = "";

		const lineElements: HTMLSpanElement[] = [];
		const numElements: HTMLSpanElement[] = [];
		const diffNumElements: HTMLSpanElement[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			const br = document.createElement("br");
			line.element.append(br);
			if (lines.hasDiff) {
				if (line.diff === DiffLineType.Insertion) {
					line.element.classList.add(options.insertedLineClassName);
				} else if (line.diff === DiffLineType.Deletion) {
					line.element.classList.add(options.deletedLineClassName);
				}
			}

			const numElement = document.createElement("span");
			numElement.classList.add(options.lineNumClassName);
			if (line.showNum) {
				if (!lines.hasDiff || line.diff !== DiffLineType.Deletion) {
					numElement.append(line.num.toString());
				}
			}

			lineElements.push(line.element);
			numElements.push(numElement);

			if (lines.hasDiff) {
				const diffNumElement = document.createElement("span");
				diffNumElement.classList.add(options.lineDiffNumClassName);
				if (line.showNum) {
					if (line.diff === DiffLineType.Insertion) {
						diffNumElement.append("+");
					} else if (line.diff === DiffLineType.Deletion) {
						diffNumElement.append(line.num.toString() + "−");
					}
				}

				diffNumElements.push(diffNumElement);
			}
		}

		container.append(...diffNumElements, ...numElements, ...lineElements);
	}

	return (
		preformattedElements: Element[],
		stylesheetParent?: Element | null,
		options?: Partial<MakeLinenumOptions>,
	) => {
		const reifiedOptions = reifyOptions(options, defaultMakeLinenumOptions);
		validateMakeLinenumOptions(reifiedOptions);

		if (stylesheetParent === undefined) {
			stylesheetParent = document.head;
		}

		for (const container of preformattedElements) {
			const lines = makeLines(container, reifiedOptions);
			if (lines === null) {
				console.error("linenum.js: failed to make lines for container, skipping:", container)
				continue;
			}

			populateContainer(container, lines, reifiedOptions);
		}

		if (stylesheetParent !== null) {
			const style = document.createElement("style");
			style.setAttribute("type", "text/css");
			style.append(getBaseStyle(reifiedOptions));
			stylesheetParent.prepend(style);
		}
	}
})();
