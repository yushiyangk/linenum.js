"use strict";
// linenum.js
// version 0.2
// Yu Shiyang <yu.shiyang@gnayihs.uy>
// Browser compatibility: ES6
// This includes support for all current browsers with any significant market share (at least 0.1%)
const makeLinenum = (() => {
    const defaultMakeLinenumOptions = {
        defaultStartNum: 1,
        containerClassName: "ln-container",
        lineClassName: "ln-line",
        lineNumClassName: "ln-num",
        startNumDataAttribute: "data-ln-start",
        skipDataAttribute: "data-ln-skip",
    };
    function validateMakeLinenumOptions(options) {
        if (!Number.isInteger(options.defaultStartNum)) {
            throw new Error(`options.defaultStartNum must be an integer, got ${options.defaultStartNum}`);
        }
        if (!options.startNumDataAttribute.startsWith("data-")) {
            throw new Error(`options.startNumDataAttribute must start with 'data-', got '${options.startNumDataAttribute}'`);
        }
        return true;
    }
    function reifyOptions(options, defaultOptions) {
        return Object.assign(Object.assign({}, defaultOptions), (options === undefined ? {} : options));
    }
    function isElement(node) {
        return node.nodeType === Node.ELEMENT_NODE;
    }
    function isTextNode(node) {
        return node.nodeType === Node.TEXT_NODE;
    }
    function isDisplayBlock(displayValue) {
        return (displayValue.startsWith("block")
            || displayValue === "flex"
            || displayValue === "grid"
            || displayValue.startsWith("flow") // "flow" or "flow-root"
            || displayValue.startsWith("table")
            || displayValue.startsWith("list"));
    }
    function getBaseStyle(options) {
        return (`:root {
	--ln-colour: slategrey;
	--ln-background-colour: ghostwhite;
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
	grid-template-columns: auto 1fr;
	grid-auto-flow: column;
	grid-gap: 0 var(--ln-num-spacing) ;
	justify-items: stretch;
	align-items: stretch;
}

.${options.lineNumClassName} {
	display: block;

	grid-column: 1;

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

	color: var(--ln-colour);
	background-color: var(--ln-background-colour);

	text-align: right;

	user-select: none;
}

.${options.lineClassName} {
	display: block;

	grid-column: 2;
}
`);
    }
    function readStartNumAttribute(element, options) {
        const startNumAttribute = element.getAttribute(options.startNumDataAttribute);
        if (startNumAttribute !== null) {
            const startNum = parseInt(startNumAttribute, 10);
            if (!Number.isNaN(startNum)) {
                return startNum;
            }
        }
        return null;
    }
    function readSkipAttribute(element, options) {
        const skipAttribute = element.getAttribute(options.skipDataAttribute);
        if (skipAttribute !== null) {
            const skip = parseInt(skipAttribute, 10);
            if (!Number.isNaN(skip)) {
                return skip;
            }
            else {
                return 0;
            }
        }
        return null;
    }
    function makeWrapper(wrapper, options) {
        const wrapperElement = wrapper.original.cloneNode(false);
        if (wrapper.idUsed) {
            wrapperElement.removeAttribute("id");
        }
        else {
            wrapper.idUsed = true;
        }
        return wrapperElement;
    }
    function makeLine(currentScanLine, wrapperStack, options) {
        const span = document.createElement("span");
        span.classList.add(options.lineClassName);
        let currentWrapper = span;
        for (let i = 0; i < wrapperStack.length; i++) {
            const wrapperElement = makeWrapper(wrapperStack[i], options);
            currentWrapper.appendChild(wrapperElement);
            currentWrapper = wrapperElement;
        }
        currentWrapper.append(...currentScanLine.children);
        const line = {
            element: span,
            num: currentScanLine.num,
            showNum: currentScanLine.showNum,
        };
        // Reset currentLine
        currentScanLine.children.length = 0;
        currentScanLine.num += 1;
        currentScanLine.showNum = true;
        return line;
    }
    function traverseTextNode(textNode, lines, currentScanLine, wrapperStack, options) {
        if (textNode.nodeType !== Node.TEXT_NODE) {
            throw new Error(`not a text node: ${textNode}`);
        }
        const text = textNode.data;
        const textLines = text.split(/\r?\n|\r/);
        for (let i = 0; i < textLines.length - 1; i++) {
            const textLine = textLines[i];
            currentScanLine.children.push(textLine);
            lines.push(makeLine(currentScanLine, wrapperStack, options));
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
    function traverseElement(element, lines, currentScanLine, wrapperStack, options) {
        const wrapperStartLine = lines.length;
        const wrapperStartChildIndex = currentScanLine.children.length;
        wrapperStack.push({ original: element, idUsed: false });
        const startNum = readStartNumAttribute(element, options);
        const skip = readSkipAttribute(element, options);
        if (skip !== null) {
            currentScanLine.num += skip - 1;
            currentScanLine.showNum = false;
            if (startNum !== null) {
                currentScanLine.num = startNum - 1;
            }
        }
        else {
            if (startNum !== null) {
                currentScanLine.num = startNum;
            }
        }
        traverse(element, lines, currentScanLine, wrapperStack, options);
        const wrappedChildren = [];
        if (lines.length === wrapperStartLine) {
            wrappedChildren.push(...currentScanLine.children.slice(wrapperStartChildIndex));
        }
        else if (lines.length > wrapperStartLine) {
            // The earlier lines have already been wrapped, so we only need to wrap from the start of the current line
            wrappedChildren.push(...currentScanLine.children);
        }
        else {
            throw new Error(`line count decreased after traversing element: ${element}`);
        }
        if (wrappedChildren.length > 0) {
            const wrapperElement = makeWrapper(wrapperStack[wrapperStack.length - 1], options);
            wrapperElement.append(...wrappedChildren);
            currentScanLine.children.length -= wrappedChildren.length;
            currentScanLine.children.push(wrapperElement);
        }
        wrapperStack.pop();
    }
    function traverse(container, lines, currentLine, wrapperStack, options) {
        const childNodes = container.childNodes;
        for (const child of childNodes) {
            let childIsBlockElement = false;
            if (isElement(child)) {
                const childElementDisplay = window.getComputedStyle(child).display;
                if (childElementDisplay === "none") {
                    console.warn("linenum.js:traverse: child element 'display' style is set to 'none', will be omitted from output:", child);
                    continue;
                }
                else if (childElementDisplay === "content") {
                    console.error("linenum.js:traverse: child element 'display' style must not be set to 'content', skipping:", child);
                    continue;
                }
                else {
                    childIsBlockElement = isDisplayBlock(childElementDisplay);
                }
            }
            if (childIsBlockElement) {
                console.error("linenum.js:traverse: child element must not be a block element, skipping: ", child);
                continue;
            }
            else if (isElement(child)) {
                traverseElement(child, lines, currentLine, wrapperStack, options);
            }
            else if (isTextNode(child)) {
                traverseTextNode(child, lines, currentLine, wrapperStack, options);
            }
            else {
                console.warn("linenum.js:traverse: child is not an element or a text node, will be omitted output", child);
                continue;
            }
        }
    }
    function makeLines(container, options) {
        var _a;
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
        const lines = [];
        const lineWrapperStack = [];
        const currentScanLine = {
            children: [],
            showNum: true,
            num: (_a = readStartNumAttribute(container, options)) !== null && _a !== void 0 ? _a : options.defaultStartNum,
        };
        traverse(container, lines, currentScanLine, lineWrapperStack, options);
        if (currentScanLine.children.length > 0) {
            lines.push(makeLine(currentScanLine, lineWrapperStack, options));
        }
        return lines;
    }
    function convertContainer(container, options) {
        container.classList.add(options.containerClassName);
    }
    function populateContainer(container, lines, options) {
        container.innerHTML = "";
        const lineElements = [];
        const numElements = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const br = document.createElement("br");
            line.element.append(br);
            const numElement = document.createElement("span");
            numElement.classList.add(options.lineNumClassName);
            if (line.showNum) {
                numElement.append(line.num.toString());
            }
            lineElements.push(line.element);
            numElements.push(numElement);
        }
        container.append(...numElements, ...lineElements);
    }
    return (preformattedElements, stylesheetParent, options) => {
        const reifiedOptions = reifyOptions(options, defaultMakeLinenumOptions);
        validateMakeLinenumOptions(reifiedOptions);
        if (stylesheetParent === undefined) {
            stylesheetParent = document.head;
        }
        for (const container of preformattedElements) {
            const lines = makeLines(container, reifiedOptions);
            if (lines === null) {
                console.error("linenum.js: failed to make lines for container, skipping:", container);
                continue;
            }
            convertContainer(container, reifiedOptions);
            populateContainer(container, lines, reifiedOptions);
        }
        if (stylesheetParent !== null) {
            const style = document.createElement("style");
            style.setAttribute("type", "text/css");
            style.append(getBaseStyle(reifiedOptions));
            stylesheetParent.prepend(style);
        }
    };
})();
