// linenum.js
// version 0.4

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
		hiddenNumCountDataAttribute: string,  // this data attribute hides line numbers for the given number of lines, including the current one
		addNumDataAttribute: string,  // this data attribute increments the line number by the given value (can be negative)

		// for diffs
		diffContainerClassName: string,
		origNumClassName: string,
		diffSignClassName: string,
		origStartNumDataAttribute: string,  // if this data attribute is not given, defaults to the same value as startNumDataAttribute
		// these data attributes specifies the number of lines, including the current one, to be treated as a diff
		insertedLineCountDataAttribute: string,
		deletedLineCountDataAttribute: string,  // deleted lines do not count towards the main line numbering
	}
	const defaultMakeLinenumOptions: MakeLinenumOptions = {
		defaultStartNum: 1,
		containerClassName: "ln-container",
		lineClassName: "ln-line",
		lineNumClassName: "ln-num",
		insertedLineClassName: "ln-ins",
		deletedLineClassName: "ln-del",
		startNumDataAttribute: "data-ln-start",
		hiddenNumCountDataAttribute: "data-ln-hide",
		addNumDataAttribute: "data-ln-add",
		diffContainerClassName: "ln-diff",
		origNumClassName: "ln-orig",
		diffSignClassName: "ln-sign",
		origStartNumDataAttribute: "data-ln-orig",
		insertedLineCountDataAttribute: "data-ln-ins",
		deletedLineCountDataAttribute: "data-ln-del",
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
			"addNumDataAttribute",
			"origStartNumDataAttribute",
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

	--ln-num-margin-before: 0;
	--ln-num-margin-after: 0;
	--ln-num-margin-vertical: 0;
	--ln-num-padding-before: 0;
	--ln-num-padding-after: 0;
	--ln-num-padding-vertical: 0;
	--ln-line-margin-before: 0;
	--ln-line-margin-after: 0;
	--ln-line-margin-vertical: 0;
	--ln-line-padding-before: 0;
	--ln-line-padding-after: 0;
	--ln-line-padding-vertical: 0;

	--ln-num-spacing: 1em;
	--ln-diff-orig-num-spacing: 1em;
	--ln-diff-num-spacing: 0.5em;
	--ln-diff-sign-spacing: 0;
}

.${options.containerClassName} {
	display: grid;
	grid-template-columns: [num] auto var(--ln-num-spacing) [line] 1fr [end];
	grid-auto-flow: column;
	grid-gap: 0;
	gap: 0;
	justify-items: stretch;
	align-items: stretch;
}
.${options.containerClassName}.${options.diffContainerClassName} {
	grid-template-columns: [orig] auto var(--ln-diff-orig-num-spacing) [num] auto var(--ln-diff-num-spacing) [sign] auto var(--ln-diff-sign-spacing) [line] 1fr [end];
}

.${options.lineNumClassName}, .${options.origNumClassName}, .${options.diffSignClassName} {
	display: block;

	margin-left: var(--ln-num-margin-before);
	margin-inline-start: var(--ln-num-margin-before);
	margin-right: var(--ln-num-margin-after);
	margin-inline-end: var(--ln-num-margin-after);
	margin-top: var(--ln-num-margin-vertical);
	margin-bottom: var(--ln-num-margin-vertical);
	padding-left: var(--ln-num-padding-before);
	padding-inline-start: var(--ln-num-padding-before);
	padding-right: var(--ln-num-padding-after);
	padding-inline-end: var(--ln-num-padding-after);
	padding-top: var(--ln-num-padding-vertical);
	padding-bottom: var(--ln-num-padding-vertical);

	color: var(--ln-num-colour);
	background-color: var(--ln-num-background);

	text-align: right;

	user-select: none;
}
.${options.origNumClassName} {
	grid-column: orig;
}
.${options.lineNumClassName} {
	grid-column: num;
}
.${options.diffSignClassName} {
	grid-column: sign;
}

.${options.lineClassName} {
	display: block;

	grid-column: line;

	margin-left: var(--ln-line-margin-before);
	margin-inline-start: var(--ln-line-margin-before);
	margin-right: var(--ln-line-margin-after);
	margin-inline-end: var(--ln-line-margin-after);
	margin-top: var(--ln-line-margin-vertical);
	margin-bottom: var(--ln-line-margin-vertical);
	padding-left: var(--ln-line-padding-before);
	padding-inline-start: var(--ln-line-padding-before);
	padding-right: var(--ln-line-padding-after);
	padding-inline-end: var(--ln-line-padding-after);
	padding-top: var(--ln-line-padding-vertical);
	padding-bottom: var(--ln-line-padding-vertical);

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


	function readIntAttribute(element: Element, attributeName: string, clampNegative: boolean = false) {
		const value = element.getAttribute(attributeName);
		if (value !== null) {
			const intValue = parseInt(value, 10);
			if (!Number.isNaN(intValue)) {
				if (clampNegative && intValue < 0) {
					return null;
				} else {
					return intValue;
				}
			} else {
				return null;
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
		num: number | null,
		origNum: number | null,
		showNum: boolean,
		diff: DiffLineType | null,
	}

	class LineArray extends Array<Line> {
		hasDiff = false;
	}

	interface DiffLineGroup {
		linesCount: number,
		type: DiffLineType,
	}

	interface ScanLine {
		children: (Node | string)[],
		num: number,
		origNum: number,
		hiddenNumLinesCount: number,
		diffLinesStack: DiffLineGroup[],
	}

	function advanceCurrentScanLine(currentScanLine: ScanLine): void {
		currentScanLine.children.length = 0;

		currentScanLine.hiddenNumLinesCount -= 1;
		if (currentScanLine.hiddenNumLinesCount <= 0) {
			currentScanLine.hiddenNumLinesCount = 0;
		}

		if (currentScanLine.diffLinesStack.length > 0) {
			const currentDiffLineGroup = currentScanLine.diffLinesStack[currentScanLine.diffLinesStack.length - 1];
			if (currentDiffLineGroup.type === DiffLineType.Insertion) {
				currentScanLine.num += 1;
			} else if (currentDiffLineGroup.type === DiffLineType.Deletion) {
				currentScanLine.origNum += 1;
			} else {
				throw new Error(`unknown diff line type: ${currentDiffLineGroup.type}`);
			}
			currentDiffLineGroup.linesCount -= 1;
			if (currentDiffLineGroup.linesCount <= 0) {
				currentScanLine.diffLinesStack.pop();
			}
		} else {
			currentScanLine.num += 1;
			currentScanLine.origNum += 1;
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

		const currentDiffLineGroup = currentScanLine.diffLinesStack.length > 0 ? currentScanLine.diffLinesStack[currentScanLine.diffLinesStack.length - 1] : null;

		const line = {
			element: span,
			num: currentDiffLineGroup?.type === DiffLineType.Deletion ? null : currentScanLine.num,
			origNum: currentDiffLineGroup?.type === DiffLineType.Insertion ? null : currentScanLine.origNum,
			showNum: !(currentScanLine.hiddenNumLinesCount > 0),
			diff: currentDiffLineGroup?.type ?? null,
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
			addLine(lines, currentScanLine, wrapperStack, options);
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

	function updateDiffLinesStack(
		element: Element,
		diffLinesCount: number,
		diffLineType: DiffLineType,
		currentScanLine: ScanLine,
		attributeNameOfDiffLineType: Record<DiffLineType, string>,
	) {
		let diffLinesOverrideRemainder = diffLinesCount;
		while (currentScanLine.diffLinesStack.length > 0 && diffLinesOverrideRemainder > 0) {
			const currentDiffLineGroup = currentScanLine.diffLinesStack[currentScanLine.diffLinesStack.length - 1];
			if (currentDiffLineGroup.type !== diffLineType) {
				const overrideLineNum = currentScanLine.num + diffLinesCount - diffLinesOverrideRemainder;
				console.warn(`linenum.js:updateDiffLinesStack: ${attributeNameOfDiffLineType[diffLineType]} attribute set on a line that is already set with ${attributeNameOfDiffLineType[currentDiffLineGroup.type]}, overriding: line ${overrideLineNum},`, element);
			}
			if (currentDiffLineGroup.linesCount <= diffLinesOverrideRemainder) {
				diffLinesOverrideRemainder -= currentDiffLineGroup.linesCount;
				currentScanLine.diffLinesStack.pop();
			} else {
				currentDiffLineGroup.linesCount -= diffLinesOverrideRemainder;
				diffLinesOverrideRemainder = 0;
			}
		}
		currentScanLine.diffLinesStack.push({
			type: diffLineType,
			linesCount: diffLinesCount,
		});
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
		const origStartNum = readIntAttribute(element, options.origStartNumDataAttribute);
		const hiddenNumLinesCount = readIntAttribute(element, options.hiddenNumCountDataAttribute, true);
		const addNum = readIntAttribute(element, options.addNumDataAttribute);

		let insertedLinesCount = readIntAttribute(element, options.insertedLineCountDataAttribute, true);
		let deletedLinesCount = readIntAttribute(element, options.deletedLineCountDataAttribute, true);
		if (insertedLinesCount !== null && deletedLinesCount !== null) {
			console.warn(`linenum.js:traverseElement: ${options.insertedLineCountDataAttribute} and ${options.deletedLineCountDataAttribute} attributes cannot both be set, ignoring both:`, element);
			insertedLinesCount = null;
			deletedLinesCount = null;
		}

		if (startNum !== null) {
			currentScanLine.num = startNum;
		}
		if (origStartNum !== null) {
			currentScanLine.origNum = origStartNum;
		}
		if (hiddenNumLinesCount !== null) {
			currentScanLine.hiddenNumLinesCount = hiddenNumLinesCount;
		}

		const attributeNameOfDiffLineType = {
			[DiffLineType.Insertion]: options.insertedLineCountDataAttribute,
			[DiffLineType.Deletion]: options.deletedLineCountDataAttribute,
		}
		if (insertedLinesCount !== null) {
			updateDiffLinesStack(element, insertedLinesCount, DiffLineType.Insertion, currentScanLine, attributeNameOfDiffLineType);
		} else if (deletedLinesCount !== null) {
			updateDiffLinesStack(element, deletedLinesCount, DiffLineType.Deletion, currentScanLine, attributeNameOfDiffLineType);
		}

		if (addNum !== null) {
			currentScanLine.num += addNum;
			currentScanLine.origNum += addNum;
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

		const wrapperElement = makeWrapperElement(wrapperStack[wrapperStack.length - 1], options);
		wrapperElement.append(...wrappedChildren);
		currentScanLine.children.length -= wrappedChildren.length;
		currentScanLine.children.push(wrapperElement);

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
		const origStartNum = readIntAttribute(container, options.origStartNumDataAttribute);
		const hiddenNumLinesCount = readIntAttribute(container, options.hiddenNumCountDataAttribute, true);
		const addNum = readIntAttribute(container, options.addNumDataAttribute) ?? 0;

		let insertedLinesCount = readIntAttribute(container, options.insertedLineCountDataAttribute, true);
		let deletedLinesCount = readIntAttribute(container, options.deletedLineCountDataAttribute, true);
		if (insertedLinesCount !== null && deletedLinesCount !== null) {
			console.warn(`linenum.js:traverseElement: ${options.insertedLineCountDataAttribute} and ${options.deletedLineCountDataAttribute} attributes cannot both be set, ignoring both:`, container);
			insertedLinesCount = null;
			deletedLinesCount = null;
		}
		const diffLinesStack = [];
		if (insertedLinesCount !== null) {
			diffLinesStack.push({
				linesCount: insertedLinesCount,
				type: DiffLineType.Insertion,
			})
		} else if (deletedLinesCount !== null) {
			diffLinesStack.push({
				linesCount: deletedLinesCount,
				type: DiffLineType.Deletion,
			})
		}

		const currentScanLine: ScanLine = {
			children: [],
			num: startNum + addNum,
			origNum: (origStartNum ?? startNum) + addNum,
			hiddenNumLinesCount: hiddenNumLinesCount ?? 0,
			diffLinesStack: diffLinesStack,
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
					if (line.num !== null) {
						numElement.append(line.num.toString());
					}
				}
			}

			lineElements.push(line.element);
			numElements.push(numElement);

			if (lines.hasDiff) {
				const origNumElement = document.createElement("span");
				origNumElement.classList.add(options.origNumClassName);
				if (line.showNum) {
					if (line.diff !== DiffLineType.Insertion && line.origNum !== null) {
						origNumElement.append(line.origNum.toString());
					}
				}

				const diffSignElement = document.createElement("span");
				diffSignElement.classList.add(options.diffSignClassName);
				if (line.diff === DiffLineType.Insertion) {
					diffSignElement.append("+");
				} else if (line.diff === DiffLineType.Deletion) {
					diffSignElement.append("−");
				}

				numElements.push(origNumElement, diffSignElement);
			}
		}

		container.append(...numElements, ...lineElements);
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
