## Changelog

### 0.3

#### Added

- Support for **diffs**, with insertion/deletion line highlighting and concurrent line numbering for the before and after
	- Enable by inserting the `data-ln-ins` or `data-ln-del` data attributes on any line within the target container
	- Line numbering for the before is set with `data-ln-orig`
	- Line numbering for the after is set with the existing `data-ln-start`
	- Line skips with `data-ln-skip` is supported for diffs as well
	- The above data attribute names can all be customised in the `makeLinenum` options
- The following options for `makeLinenum`:
	- `insertedLineClassName` — used for highlighting inserted lines
	- `deletedLineClassName` — used for highlighting deleted lines
	- `diffContainerClassName` — applied alongside `containerClassName` if any `data-ln-ins` or `data-ln-del` are detected within it
	- `origNumClassName` — used for the before line numbers (the after line numbers use `lineNumClassName` as usual)
	- `diffSignClassName` — used for the +/− symbol
	- `origNumDataAttribute`, `insertedLinesCountDataAttribute`, `deletedLinesCountDataAttribute` — configurable data attribute names
- The following CSS variables:
	- `--ln-line-colour`
	- `--ln-line-background`
	- `--ln-insertion-background`
	- `--ln-deletion-background`
	- `--ln-line-padding-before`, `--ln-line-padding-after`, `--ln-line-padding-vertical`
	- `--ln-line-margin-before`, `--ln-line-margin-after`, `--ln-line-margin-vertical`
	- `--ln-diff-orig-num-spacing`
	- `--ln-diff-num-spacing`
	- `--ln-diff-sign-spacing`

#### Changed

- The following CSS variables are renamed:
	- `--ln-colour` to `--ln-num-colour`
	- `--ln-background-colour` to `--ln-num-background`
	- `--ln-padding-*` to `--ln-num-padding-*`
	- `--ln-margin-*` to `--ln-num-margin-*`
- CSS Grid layout is changed
	- Column spacing is now implemented as additional empty columns
	- There are now column names: it is recommended to use these for any additional styling instead of column numbers
- Line numbers are now right-aligned by default

#### Fixed

- Input inline elements that start in the middle of a line and end on a different line are now correctly rendered (previously, the entire line that it starts on would end up getting wrapped by it in the output)


### 0.2

#### Changed

- Option fields no longer accept the `null` value, and the generated elements will always have a class attached

#### Fixed

- Select and copy now produces well-formatted text in Firefox (no issue in other browsers)
- Injected stylesheet will now follow the classes specified in the given options

### 0.1.1

**Added**: Automatically inject a base stylesheet

### 0.1

Initial version
