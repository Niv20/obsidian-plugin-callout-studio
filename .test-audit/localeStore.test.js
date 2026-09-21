// tests/localeStore.test.ts
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

// ../../../../../../Desktop/try/.obsidian/plugins/obsidian-Plugin-Callout-Studio/node_modules/@marijn/find-cluster-break/src/index.js
var rangeFrom = [];
var rangeTo = [];
(() => {
  let numbers = "lc,34,7n,7,7b,19,,,,2,,2,,,20,b,1c,l,g,,2t,7,2,6,2,2,,4,z,,u,r,2j,b,1m,9,9,,o,4,,9,,3,,5,17,3,3b,f,,w,1j,,,,4,8,4,,3,7,a,2,t,,1m,,,,2,4,8,,9,,a,2,q,,2,2,1l,,4,2,4,2,2,3,3,,u,2,3,,b,2,1l,,4,5,,2,4,,k,2,m,6,,,1m,,,2,,4,8,,7,3,a,2,u,,1n,,,,c,,9,,14,,3,,1l,3,5,3,,4,7,2,b,2,t,,1m,,2,,2,,3,,5,2,7,2,b,2,s,2,1l,2,,,2,4,8,,9,,a,2,t,,20,,4,,2,3,,,8,,29,,2,7,c,8,2q,,2,9,b,6,22,2,r,,,,,,1j,e,,5,,2,5,b,,10,9,,2u,4,,6,,2,2,2,p,2,4,3,g,4,d,,2,2,6,,f,,jj,3,qa,3,t,3,t,2,u,2,1s,2,,7,8,,2,b,9,,19,3,3b,2,y,,3a,3,4,2,9,,6,3,63,2,2,,1m,,,7,,,,,2,8,6,a,2,,1c,h,1r,4,1c,7,,,5,,14,9,c,2,w,4,2,2,,3,1k,,,2,3,,,3,1m,8,2,2,48,3,,d,,7,4,,6,,3,2,5i,1m,,5,ek,,5f,x,2da,3,3x,,2o,w,fe,6,2x,2,n9w,4,,a,w,2,28,2,7k,,3,,4,,p,2,5,,47,2,q,i,d,,12,8,p,b,1a,3,1c,,2,4,2,2,13,,1v,6,2,2,2,2,c,,8,,1b,,1f,,,3,2,2,5,2,,,16,2,8,,6m,,2,,4,,fn4,,kh,g,g,g,a6,2,gt,,6a,,45,5,1ae,3,,2,5,4,14,3,4,,4l,2,fx,4,ar,2,49,b,4w,,1i,f,1k,3,1d,4,2,2,1x,3,10,5,,8,1q,,c,2,1g,9,a,4,2,,2n,3,2,,,2,6,,4g,,3,8,l,2,1l,2,,,,,m,,e,7,3,5,5f,8,2,3,,,n,,29,,2,6,,,2,,,2,,2,6j,,2,4,6,2,,2,r,2,2d,8,2,,,2,2y,,,,2,6,,,2t,3,2,4,,5,77,9,,2,6t,,a,2,,,4,,40,4,2,2,4,,w,a,14,6,2,4,8,,9,6,2,3,1a,d,,2,ba,7,,6,,,2a,m,2,7,,2,,2,3e,6,3,,,2,,7,,,20,2,3,,,,9n,2,f0b,5,1n,7,t4,,1r,4,29,,f5k,2,43q,,,3,4,5,8,8,2,7,u,4,44,3,1iz,1j,4,1e,8,,e,,m,5,,f,11s,7,,h,2,7,,2,,5,79,7,c5,4,15s,7,31,7,240,5,gx7k,2o,3k,6o".split(",").map((s) => s ? parseInt(s, 36) : 1);
  for (let i = 0, n = 0; i < numbers.length; i++)
    (i % 2 ? rangeTo : rangeFrom).push(n = n + numbers[i]);
})();
function isExtendingChar(code) {
  if (code < 768) return false;
  for (let from = 0, to = rangeFrom.length; ; ) {
    let mid = from + to >> 1;
    if (code < rangeFrom[mid]) to = mid;
    else if (code >= rangeTo[mid]) from = mid + 1;
    else return true;
    if (from == to) return false;
  }
}
function isRegionalIndicator(code) {
  return code >= 127462 && code <= 127487;
}
var ZWJ = 8205;
function findClusterBreak(str, pos, forward = true, includeExtending = true) {
  return (forward ? nextClusterBreak : prevClusterBreak)(str, pos, includeExtending);
}
function nextClusterBreak(str, pos, includeExtending) {
  if (pos == str.length) return pos;
  if (pos && surrogateLow(str.charCodeAt(pos)) && surrogateHigh(str.charCodeAt(pos - 1))) pos--;
  let prev = codePointAt(str, pos);
  pos += codePointSize(prev);
  while (pos < str.length) {
    let next = codePointAt(str, pos);
    if (prev == ZWJ || next == ZWJ || includeExtending && isExtendingChar(next)) {
      pos += codePointSize(next);
      prev = next;
    } else if (isRegionalIndicator(next)) {
      let countBefore = 0, i = pos - 2;
      while (i >= 0 && isRegionalIndicator(codePointAt(str, i))) {
        countBefore++;
        i -= 2;
      }
      if (countBefore % 2 == 0) break;
      else pos += 2;
    } else {
      break;
    }
  }
  return pos;
}
function prevClusterBreak(str, pos, includeExtending) {
  while (pos > 0) {
    let found = nextClusterBreak(str, pos - 2, includeExtending);
    if (found < pos) return found;
    pos--;
  }
  return 0;
}
function codePointAt(str, pos) {
  let code0 = str.charCodeAt(pos);
  if (!surrogateHigh(code0) || pos + 1 == str.length) return code0;
  let code1 = str.charCodeAt(pos + 1);
  if (!surrogateLow(code1)) return code0;
  return (code0 - 55296 << 10) + (code1 - 56320) + 65536;
}
function surrogateLow(ch) {
  return ch >= 56320 && ch < 57344;
}
function surrogateHigh(ch) {
  return ch >= 55296 && ch < 56320;
}
function codePointSize(code) {
  return code < 65536 ? 1 : 2;
}

// ../../../../../../Desktop/try/.obsidian/plugins/obsidian-Plugin-Callout-Studio/node_modules/@codemirror/state/dist/index.js
var Text = class _Text {
  /**
  Get the line description around the given position.
  */
  lineAt(pos) {
    if (pos < 0 || pos > this.length)
      throw new RangeError(`Invalid position ${pos} in document of length ${this.length}`);
    return this.lineInner(pos, false, 1, 0);
  }
  /**
  Get the description for the given (1-based) line number.
  */
  line(n) {
    if (n < 1 || n > this.lines)
      throw new RangeError(`Invalid line number ${n} in ${this.lines}-line document`);
    return this.lineInner(n, true, 1, 0);
  }
  /**
  Replace a range of the text with the given content.
  */
  replace(from, to, text) {
    [from, to] = clip(this, from, to);
    let parts = [];
    this.decompose(
      0,
      from,
      parts,
      2
      /* Open.To */
    );
    if (text.length)
      text.decompose(
        0,
        text.length,
        parts,
        1 | 2
        /* Open.To */
      );
    this.decompose(
      to,
      this.length,
      parts,
      1
      /* Open.From */
    );
    return TextNode.from(parts, this.length - (to - from) + text.length);
  }
  /**
  Append another document to this one.
  */
  append(other) {
    return this.replace(this.length, this.length, other);
  }
  /**
  Retrieve the text between the given points.
  */
  slice(from, to = this.length) {
    [from, to] = clip(this, from, to);
    let parts = [];
    this.decompose(from, to, parts, 0);
    return TextNode.from(parts, to - from);
  }
  /**
  Test whether this text is equal to another instance.
  */
  eq(other) {
    if (other == this)
      return true;
    if (other.length != this.length || other.lines != this.lines)
      return false;
    let start = this.scanIdentical(other, 1), end = this.length - this.scanIdentical(other, -1);
    let a = new RawTextCursor(this), b = new RawTextCursor(other);
    for (let skip = start, pos = start; ; ) {
      a.next(skip);
      b.next(skip);
      skip = 0;
      if (a.lineBreak != b.lineBreak || a.done != b.done || a.value != b.value)
        return false;
      pos += a.value.length;
      if (a.done || pos >= end)
        return true;
    }
  }
  /**
  Iterate over the text. When `dir` is `-1`, iteration happens
  from end to start. This will return lines and the breaks between
  them as separate strings.
  */
  iter(dir = 1) {
    return new RawTextCursor(this, dir);
  }
  /**
  Iterate over a range of the text. When `from` > `to`, the
  iterator will run in reverse.
  */
  iterRange(from, to = this.length) {
    return new PartialTextCursor(this, from, to);
  }
  /**
  Return a cursor that iterates over the given range of lines,
  _without_ returning the line breaks between, and yielding empty
  strings for empty lines.
  
  When `from` and `to` are given, they should be 1-based line numbers.
  */
  iterLines(from, to) {
    let inner;
    if (from == null) {
      inner = this.iter();
    } else {
      if (to == null)
        to = this.lines + 1;
      let start = this.line(from).from;
      inner = this.iterRange(start, Math.max(start, to == this.lines + 1 ? this.length : to <= 1 ? 0 : this.line(to - 1).to));
    }
    return new LineCursor(inner);
  }
  /**
  Return the document as a string, using newline characters to
  separate lines.
  */
  toString() {
    return this.sliceString(0);
  }
  /**
  Convert the document to an array of lines (which can be
  deserialized again via [`Text.of`](https://codemirror.net/6/docs/ref/#state.Text^of)).
  */
  toJSON() {
    let lines = [];
    this.flatten(lines);
    return lines;
  }
  /**
  @internal
  */
  constructor() {
  }
  /**
  Create a `Text` instance for the given array of lines.
  */
  static of(text) {
    if (text.length == 0)
      throw new RangeError("A document must have at least one line");
    if (text.length == 1 && !text[0])
      return _Text.empty;
    return text.length <= 32 ? new TextLeaf(text) : TextNode.from(TextLeaf.split(text, []));
  }
};
var TextLeaf = class _TextLeaf extends Text {
  constructor(text, length = textLength(text)) {
    super();
    this.text = text;
    this.length = length;
  }
  get lines() {
    return this.text.length;
  }
  get children() {
    return null;
  }
  lineInner(target, isLine, line, offset) {
    for (let i = 0; ; i++) {
      let string = this.text[i], end = offset + string.length;
      if ((isLine ? line : end) >= target)
        return new Line(offset, end, line, string);
      offset = end + 1;
      line++;
    }
  }
  decompose(from, to, target, open) {
    let text = from <= 0 && to >= this.length ? this : new _TextLeaf(sliceText(this.text, from, to), Math.min(to, this.length) - Math.max(0, from));
    if (open & 1) {
      let prev = target.pop();
      let joined = appendText(text.text, prev.text.slice(), 0, text.length);
      if (joined.length <= 32) {
        target.push(new _TextLeaf(joined, prev.length + text.length));
      } else {
        let mid = joined.length >> 1;
        target.push(new _TextLeaf(joined.slice(0, mid)), new _TextLeaf(joined.slice(mid)));
      }
    } else {
      target.push(text);
    }
  }
  replace(from, to, text) {
    if (!(text instanceof _TextLeaf))
      return super.replace(from, to, text);
    [from, to] = clip(this, from, to);
    let lines = appendText(this.text, appendText(text.text, sliceText(this.text, 0, from)), to);
    let newLen = this.length + text.length - (to - from);
    if (lines.length <= 32)
      return new _TextLeaf(lines, newLen);
    return TextNode.from(_TextLeaf.split(lines, []), newLen);
  }
  sliceString(from, to = this.length, lineSep = "\n") {
    [from, to] = clip(this, from, to);
    let result = "";
    for (let pos = 0, i = 0; pos <= to && i < this.text.length; i++) {
      let line = this.text[i], end = pos + line.length;
      if (pos > from && i)
        result += lineSep;
      if (from < end && to > pos)
        result += line.slice(Math.max(0, from - pos), to - pos);
      pos = end + 1;
    }
    return result;
  }
  flatten(target) {
    for (let line of this.text)
      target.push(line);
  }
  scanIdentical() {
    return 0;
  }
  static split(text, target) {
    let part = [], len = -1;
    for (let line of text) {
      part.push(line);
      len += line.length + 1;
      if (part.length == 32) {
        target.push(new _TextLeaf(part, len));
        part = [];
        len = -1;
      }
    }
    if (len > -1)
      target.push(new _TextLeaf(part, len));
    return target;
  }
};
var TextNode = class _TextNode extends Text {
  constructor(children, length) {
    super();
    this.children = children;
    this.length = length;
    this.lines = 0;
    for (let child of children)
      this.lines += child.lines;
  }
  lineInner(target, isLine, line, offset) {
    for (let i = 0; ; i++) {
      let child = this.children[i], end = offset + child.length, endLine = line + child.lines - 1;
      if ((isLine ? endLine : end) >= target)
        return child.lineInner(target, isLine, line, offset);
      offset = end + 1;
      line = endLine + 1;
    }
  }
  decompose(from, to, target, open) {
    for (let i = 0, pos = 0; pos <= to && i < this.children.length; i++) {
      let child = this.children[i], end = pos + child.length;
      if (from <= end && to >= pos) {
        let childOpen = open & ((pos <= from ? 1 : 0) | (end >= to ? 2 : 0));
        if (pos >= from && end <= to && !childOpen)
          target.push(child);
        else
          child.decompose(from - pos, to - pos, target, childOpen);
      }
      pos = end + 1;
    }
  }
  replace(from, to, text) {
    [from, to] = clip(this, from, to);
    if (text.lines < this.lines)
      for (let i = 0, pos = 0; i < this.children.length; i++) {
        let child = this.children[i], end = pos + child.length;
        if (from >= pos && to <= end) {
          let updated = child.replace(from - pos, to - pos, text);
          let totalLines = this.lines - child.lines + updated.lines;
          if (updated.lines < totalLines >> 5 - 1 && updated.lines > totalLines >> 5 + 1) {
            let copy = this.children.slice();
            copy[i] = updated;
            return new _TextNode(copy, this.length - (to - from) + text.length);
          }
          return super.replace(pos, end, updated);
        }
        pos = end + 1;
      }
    return super.replace(from, to, text);
  }
  sliceString(from, to = this.length, lineSep = "\n") {
    [from, to] = clip(this, from, to);
    let result = "";
    for (let i = 0, pos = 0; i < this.children.length && pos <= to; i++) {
      let child = this.children[i], end = pos + child.length;
      if (pos > from && i)
        result += lineSep;
      if (from < end && to > pos)
        result += child.sliceString(from - pos, to - pos, lineSep);
      pos = end + 1;
    }
    return result;
  }
  flatten(target) {
    for (let child of this.children)
      child.flatten(target);
  }
  scanIdentical(other, dir) {
    if (!(other instanceof _TextNode))
      return 0;
    let length = 0;
    let [iA, iB, eA, eB] = dir > 0 ? [0, 0, this.children.length, other.children.length] : [this.children.length - 1, other.children.length - 1, -1, -1];
    for (; ; iA += dir, iB += dir) {
      if (iA == eA || iB == eB)
        return length;
      let chA = this.children[iA], chB = other.children[iB];
      if (chA != chB)
        return length + chA.scanIdentical(chB, dir);
      length += chA.length + 1;
    }
  }
  static from(children, length = children.reduce((l, ch) => l + ch.length + 1, -1)) {
    let lines = 0;
    for (let ch of children)
      lines += ch.lines;
    if (lines < 32) {
      let flat = [];
      for (let ch of children)
        ch.flatten(flat);
      return new TextLeaf(flat, length);
    }
    let chunk = Math.max(
      32,
      lines >> 5
      /* Tree.BranchShift */
    ), maxChunk = chunk << 1, minChunk = chunk >> 1;
    let chunked = [], currentLines = 0, currentLen = -1, currentChunk = [];
    function add(child) {
      let last;
      if (child.lines > maxChunk && child instanceof _TextNode) {
        for (let node of child.children)
          add(node);
      } else if (child.lines > minChunk && (currentLines > minChunk || !currentLines)) {
        flush();
        chunked.push(child);
      } else if (child instanceof TextLeaf && currentLines && (last = currentChunk[currentChunk.length - 1]) instanceof TextLeaf && child.lines + last.lines <= 32) {
        currentLines += child.lines;
        currentLen += child.length + 1;
        currentChunk[currentChunk.length - 1] = new TextLeaf(last.text.concat(child.text), last.length + 1 + child.length);
      } else {
        if (currentLines + child.lines > chunk)
          flush();
        currentLines += child.lines;
        currentLen += child.length + 1;
        currentChunk.push(child);
      }
    }
    function flush() {
      if (currentLines == 0)
        return;
      chunked.push(currentChunk.length == 1 ? currentChunk[0] : _TextNode.from(currentChunk, currentLen));
      currentLen = -1;
      currentLines = currentChunk.length = 0;
    }
    for (let child of children)
      add(child);
    flush();
    return chunked.length == 1 ? chunked[0] : new _TextNode(chunked, length);
  }
};
Text.empty = /* @__PURE__ */ new TextLeaf([""], 0);
function textLength(text) {
  let length = -1;
  for (let line of text)
    length += line.length + 1;
  return length;
}
function appendText(text, target, from = 0, to = 1e9) {
  for (let pos = 0, i = 0, first = true; i < text.length && pos <= to; i++) {
    let line = text[i], end = pos + line.length;
    if (end >= from) {
      if (end > to)
        line = line.slice(0, to - pos);
      if (pos < from)
        line = line.slice(from - pos);
      if (first) {
        target[target.length - 1] += line;
        first = false;
      } else
        target.push(line);
    }
    pos = end + 1;
  }
  return target;
}
function sliceText(text, from, to) {
  return appendText(text, [""], from, to);
}
var RawTextCursor = class {
  constructor(text, dir = 1) {
    this.dir = dir;
    this.done = false;
    this.lineBreak = false;
    this.value = "";
    this.nodes = [text];
    this.offsets = [dir > 0 ? 1 : (text instanceof TextLeaf ? text.text.length : text.children.length) << 1];
  }
  nextInner(skip, dir) {
    this.done = this.lineBreak = false;
    for (; ; ) {
      let last = this.nodes.length - 1;
      let top = this.nodes[last], offsetValue = this.offsets[last], offset = offsetValue >> 1;
      let size = top instanceof TextLeaf ? top.text.length : top.children.length;
      if (offset == (dir > 0 ? size : 0)) {
        if (last == 0) {
          this.done = true;
          this.value = "";
          return this;
        }
        if (dir > 0)
          this.offsets[last - 1]++;
        this.nodes.pop();
        this.offsets.pop();
      } else if ((offsetValue & 1) == (dir > 0 ? 0 : 1)) {
        this.offsets[last] += dir;
        if (skip == 0) {
          this.lineBreak = true;
          this.value = "\n";
          return this;
        }
        skip--;
      } else if (top instanceof TextLeaf) {
        let next = top.text[offset + (dir < 0 ? -1 : 0)];
        this.offsets[last] += dir;
        if (next.length > Math.max(0, skip)) {
          this.value = skip == 0 ? next : dir > 0 ? next.slice(skip) : next.slice(0, next.length - skip);
          return this;
        }
        skip -= next.length;
      } else {
        let next = top.children[offset + (dir < 0 ? -1 : 0)];
        if (skip > next.length) {
          skip -= next.length;
          this.offsets[last] += dir;
        } else {
          if (dir < 0)
            this.offsets[last]--;
          this.nodes.push(next);
          this.offsets.push(dir > 0 ? 1 : (next instanceof TextLeaf ? next.text.length : next.children.length) << 1);
        }
      }
    }
  }
  next(skip = 0) {
    if (skip < 0) {
      this.nextInner(-skip, -this.dir);
      skip = this.value.length;
    }
    return this.nextInner(skip, this.dir);
  }
};
var PartialTextCursor = class {
  constructor(text, start, end) {
    this.value = "";
    this.done = false;
    this.cursor = new RawTextCursor(text, start > end ? -1 : 1);
    this.pos = start > end ? text.length : 0;
    this.from = Math.min(start, end);
    this.to = Math.max(start, end);
  }
  nextInner(skip, dir) {
    if (dir < 0 ? this.pos <= this.from : this.pos >= this.to) {
      this.value = "";
      this.done = true;
      return this;
    }
    skip += Math.max(0, dir < 0 ? this.pos - this.to : this.from - this.pos);
    let limit = dir < 0 ? this.pos - this.from : this.to - this.pos;
    if (skip > limit)
      skip = limit;
    limit -= skip;
    let { value } = this.cursor.next(skip);
    this.pos += (value.length + skip) * dir;
    this.value = value.length <= limit ? value : dir < 0 ? value.slice(value.length - limit) : value.slice(0, limit);
    this.done = !this.value;
    return this;
  }
  next(skip = 0) {
    if (skip < 0)
      skip = Math.max(skip, this.from - this.pos);
    else if (skip > 0)
      skip = Math.min(skip, this.to - this.pos);
    return this.nextInner(skip, this.cursor.dir);
  }
  get lineBreak() {
    return this.cursor.lineBreak && this.value != "";
  }
};
var LineCursor = class {
  constructor(inner) {
    this.inner = inner;
    this.afterBreak = true;
    this.value = "";
    this.done = false;
  }
  next(skip = 0) {
    let { done, lineBreak, value } = this.inner.next(skip);
    if (done && this.afterBreak) {
      this.value = "";
      this.afterBreak = false;
    } else if (done) {
      this.done = true;
      this.value = "";
    } else if (lineBreak) {
      if (this.afterBreak) {
        this.value = "";
      } else {
        this.afterBreak = true;
        this.next();
      }
    } else {
      this.value = value;
      this.afterBreak = false;
    }
    return this;
  }
  get lineBreak() {
    return false;
  }
};
if (typeof Symbol != "undefined") {
  Text.prototype[Symbol.iterator] = function() {
    return this.iter();
  };
  RawTextCursor.prototype[Symbol.iterator] = PartialTextCursor.prototype[Symbol.iterator] = LineCursor.prototype[Symbol.iterator] = function() {
    return this;
  };
}
var Line = class {
  /**
  @internal
  */
  constructor(from, to, number, text) {
    this.from = from;
    this.to = to;
    this.number = number;
    this.text = text;
  }
  /**
  The length of the line (not including any line break after it).
  */
  get length() {
    return this.to - this.from;
  }
};
function clip(text, from, to) {
  from = Math.max(0, Math.min(text.length, from));
  return [from, Math.max(from, Math.min(text.length, to))];
}
function findClusterBreak2(str, pos, forward = true, includeExtending = true) {
  return findClusterBreak(str, pos, forward, includeExtending);
}
var DefaultSplit = /\r\n?|\n/;
var MapMode = /* @__PURE__ */ function(MapMode2) {
  MapMode2[MapMode2["Simple"] = 0] = "Simple";
  MapMode2[MapMode2["TrackDel"] = 1] = "TrackDel";
  MapMode2[MapMode2["TrackBefore"] = 2] = "TrackBefore";
  MapMode2[MapMode2["TrackAfter"] = 3] = "TrackAfter";
  return MapMode2;
}(MapMode || (MapMode = {}));
var ChangeDesc = class _ChangeDesc {
  // Sections are encoded as pairs of integers. The first is the
  // length in the current document, and the second is -1 for
  // unaffected sections, and the length of the replacement content
  // otherwise. So an insertion would be (0, n>0), a deletion (n>0,
  // 0), and a replacement two positive numbers.
  /**
  @internal
  */
  constructor(sections) {
    this.sections = sections;
  }
  /**
  The length of the document before the change.
  */
  get length() {
    let result = 0;
    for (let i = 0; i < this.sections.length; i += 2)
      result += this.sections[i];
    return result;
  }
  /**
  The length of the document after the change.
  */
  get newLength() {
    let result = 0;
    for (let i = 0; i < this.sections.length; i += 2) {
      let ins = this.sections[i + 1];
      result += ins < 0 ? this.sections[i] : ins;
    }
    return result;
  }
  /**
  False when there are actual changes in this set.
  */
  get empty() {
    return this.sections.length == 0 || this.sections.length == 2 && this.sections[1] < 0;
  }
  /**
  Iterate over the unchanged parts left by these changes. `posA`
  provides the position of the range in the old document, `posB`
  the new position in the changed document.
  */
  iterGaps(f) {
    for (let i = 0, posA = 0, posB = 0; i < this.sections.length; ) {
      let len = this.sections[i++], ins = this.sections[i++];
      if (ins < 0) {
        f(posA, posB, len);
        posB += len;
      } else {
        posB += ins;
      }
      posA += len;
    }
  }
  /**
  Iterate over the ranges changed by these changes. (See
  [`ChangeSet.iterChanges`](https://codemirror.net/6/docs/ref/#state.ChangeSet.iterChanges) for a
  variant that also provides you with the inserted text.)
  `fromA`/`toA` provides the extent of the change in the starting
  document, `fromB`/`toB` the extent of the replacement in the
  changed document.
  
  When `individual` is true, adjacent changes (which are kept
  separate for [position mapping](https://codemirror.net/6/docs/ref/#state.ChangeDesc.mapPos)) are
  reported separately.
  */
  iterChangedRanges(f, individual = false) {
    iterChanges(this, f, individual);
  }
  /**
  Get a description of the inverted form of these changes.
  */
  get invertedDesc() {
    let sections = [];
    for (let i = 0; i < this.sections.length; ) {
      let len = this.sections[i++], ins = this.sections[i++];
      if (ins < 0)
        sections.push(len, ins);
      else
        sections.push(ins, len);
    }
    return new _ChangeDesc(sections);
  }
  /**
  Compute the combined effect of applying another set of changes
  after this one. The length of the document after this set should
  match the length before `other`.
  */
  composeDesc(other) {
    return this.empty ? other : other.empty ? this : composeSets(this, other);
  }
  /**
  Map this description, which should start with the same document
  as `other`, over another set of changes, so that it can be
  applied after it. When `before` is true, map as if the changes
  in `this` happened before the ones in `other`.
  */
  mapDesc(other, before = false) {
    return other.empty ? this : mapSet(this, other, before);
  }
  mapPos(pos, assoc = -1, mode = MapMode.Simple) {
    let posA = 0, posB = 0;
    for (let i = 0; i < this.sections.length; ) {
      let len = this.sections[i++], ins = this.sections[i++], endA = posA + len;
      if (ins < 0) {
        if (endA > pos)
          return posB + (pos - posA);
        posB += len;
      } else {
        if (mode != MapMode.Simple && endA >= pos && (mode == MapMode.TrackDel && posA < pos && endA > pos || mode == MapMode.TrackBefore && posA < pos || mode == MapMode.TrackAfter && endA > pos))
          return null;
        if (endA > pos || endA == pos && assoc < 0 && !len)
          return pos == posA || assoc < 0 ? posB : posB + ins;
        posB += ins;
      }
      posA = endA;
    }
    if (pos > posA)
      throw new RangeError(`Position ${pos} is out of range for changeset of length ${posA}`);
    return posB;
  }
  /**
  Check whether these changes touch a given range. When one of the
  changes entirely covers the range, the string `"cover"` is
  returned.
  */
  touchesRange(from, to = from) {
    for (let i = 0, pos = 0; i < this.sections.length && pos <= to; ) {
      let len = this.sections[i++], ins = this.sections[i++], end = pos + len;
      if (ins >= 0 && pos <= to && end >= from)
        return pos < from && end > to ? "cover" : true;
      pos = end;
    }
    return false;
  }
  /**
  @internal
  */
  toString() {
    let result = "";
    for (let i = 0; i < this.sections.length; ) {
      let len = this.sections[i++], ins = this.sections[i++];
      result += (result ? " " : "") + len + (ins >= 0 ? ":" + ins : "");
    }
    return result;
  }
  /**
  Serialize this change desc to a JSON-representable value.
  */
  toJSON() {
    return this.sections;
  }
  /**
  Create a change desc from its JSON representation (as produced
  by [`toJSON`](https://codemirror.net/6/docs/ref/#state.ChangeDesc.toJSON).
  */
  static fromJSON(json) {
    if (!Array.isArray(json) || json.length % 2 || json.some((a) => typeof a != "number"))
      throw new RangeError("Invalid JSON representation of ChangeDesc");
    return new _ChangeDesc(json);
  }
  /**
  @internal
  */
  static create(sections) {
    return new _ChangeDesc(sections);
  }
};
var ChangeSet = class _ChangeSet extends ChangeDesc {
  constructor(sections, inserted) {
    super(sections);
    this.inserted = inserted;
  }
  /**
  Apply the changes to a document, returning the modified
  document.
  */
  apply(doc) {
    if (this.length != doc.length)
      throw new RangeError("Applying change set to a document with the wrong length");
    iterChanges(this, (fromA, toA, fromB, _toB, text) => doc = doc.replace(fromB, fromB + (toA - fromA), text), false);
    return doc;
  }
  mapDesc(other, before = false) {
    return mapSet(this, other, before, true);
  }
  /**
  Given the document as it existed _before_ the changes, return a
  change set that represents the inverse of this set, which could
  be used to go from the document created by the changes back to
  the document as it existed before the changes.
  */
  invert(doc) {
    let sections = this.sections.slice(), inserted = [];
    for (let i = 0, pos = 0; i < sections.length; i += 2) {
      let len = sections[i], ins = sections[i + 1];
      if (ins >= 0) {
        sections[i] = ins;
        sections[i + 1] = len;
        let index = i >> 1;
        while (inserted.length < index)
          inserted.push(Text.empty);
        inserted.push(len ? doc.slice(pos, pos + len) : Text.empty);
      }
      pos += len;
    }
    return new _ChangeSet(sections, inserted);
  }
  /**
  Combine two subsequent change sets into a single set. `other`
  must start in the document produced by `this`. If `this` goes
  `docA` → `docB` and `other` represents `docB` → `docC`, the
  returned value will represent the change `docA` → `docC`.
  */
  compose(other) {
    return this.empty ? other : other.empty ? this : composeSets(this, other, true);
  }
  /**
  Given another change set starting in the same document, maps this
  change set over the other, producing a new change set that can be
  applied to the document produced by applying `other`. When
  `before` is `true`, order changes as if `this` comes before
  `other`, otherwise (the default) treat `other` as coming first.
  
  Given two changes `A` and `B`, `A.compose(B.map(A))` and
  `B.compose(A.map(B, true))` will produce the same document. This
  provides a basic form of [operational
  transformation](https://en.wikipedia.org/wiki/Operational_transformation),
  and can be used for collaborative editing.
  */
  map(other, before = false) {
    return other.empty ? this : mapSet(this, other, before, true);
  }
  /**
  Iterate over the changed ranges in the document, calling `f` for
  each, with the range in the original document (`fromA`-`toA`)
  and the range that replaces it in the new document
  (`fromB`-`toB`).
  
  When `individual` is true, adjacent changes are reported
  separately.
  */
  iterChanges(f, individual = false) {
    iterChanges(this, f, individual);
  }
  /**
  Get a [change description](https://codemirror.net/6/docs/ref/#state.ChangeDesc) for this change
  set.
  */
  get desc() {
    return ChangeDesc.create(this.sections);
  }
  /**
  @internal
  */
  filter(ranges) {
    let resultSections = [], resultInserted = [], filteredSections = [];
    let iter = new SectionIter(this);
    done: for (let i = 0, pos = 0; ; ) {
      let next = i == ranges.length ? 1e9 : ranges[i++];
      while (pos < next || pos == next && iter.len == 0) {
        if (iter.done)
          break done;
        let len = Math.min(iter.len, next - pos);
        addSection(filteredSections, len, -1);
        let ins = iter.ins == -1 ? -1 : iter.off == 0 ? iter.ins : 0;
        addSection(resultSections, len, ins);
        if (ins > 0)
          addInsert(resultInserted, resultSections, iter.text);
        iter.forward(len);
        pos += len;
      }
      let end = ranges[i++];
      while (pos < end) {
        if (iter.done)
          break done;
        let len = Math.min(iter.len, end - pos);
        addSection(resultSections, len, -1);
        addSection(filteredSections, len, iter.ins == -1 ? -1 : iter.off == 0 ? iter.ins : 0);
        iter.forward(len);
        pos += len;
      }
    }
    return {
      changes: new _ChangeSet(resultSections, resultInserted),
      filtered: ChangeDesc.create(filteredSections)
    };
  }
  /**
  Serialize this change set to a JSON-representable value.
  */
  toJSON() {
    let parts = [];
    for (let i = 0; i < this.sections.length; i += 2) {
      let len = this.sections[i], ins = this.sections[i + 1];
      if (ins < 0)
        parts.push(len);
      else if (ins == 0)
        parts.push([len]);
      else
        parts.push([len].concat(this.inserted[i >> 1].toJSON()));
    }
    return parts;
  }
  /**
  Create a change set for the given changes, for a document of the
  given length, using `lineSep` as line separator.
  */
  static of(changes, length, lineSep) {
    let sections = [], inserted = [], pos = 0;
    let total = null;
    function flush(force = false) {
      if (!force && !sections.length)
        return;
      if (pos < length)
        addSection(sections, length - pos, -1);
      let set = new _ChangeSet(sections, inserted);
      total = total ? total.compose(set.map(total)) : set;
      sections = [];
      inserted = [];
      pos = 0;
    }
    function process2(spec) {
      if (Array.isArray(spec)) {
        for (let sub of spec)
          process2(sub);
      } else if (spec instanceof _ChangeSet) {
        if (spec.length != length)
          throw new RangeError(`Mismatched change set length (got ${spec.length}, expected ${length})`);
        flush();
        total = total ? total.compose(spec.map(total)) : spec;
      } else {
        let { from, to = from, insert: insert2 } = spec;
        if (from > to || from < 0 || to > length)
          throw new RangeError(`Invalid change range ${from} to ${to} (in doc of length ${length})`);
        let insText = !insert2 ? Text.empty : typeof insert2 == "string" ? Text.of(insert2.split(lineSep || DefaultSplit)) : insert2;
        let insLen = insText.length;
        if (from == to && insLen == 0)
          return;
        if (from < pos)
          flush();
        if (from > pos)
          addSection(sections, from - pos, -1);
        addSection(sections, to - from, insLen);
        addInsert(inserted, sections, insText);
        pos = to;
      }
    }
    process2(changes);
    flush(!total);
    return total;
  }
  /**
  Create an empty changeset of the given length.
  */
  static empty(length) {
    return new _ChangeSet(length ? [length, -1] : [], []);
  }
  /**
  Create a changeset from its JSON representation (as produced by
  [`toJSON`](https://codemirror.net/6/docs/ref/#state.ChangeSet.toJSON).
  */
  static fromJSON(json) {
    if (!Array.isArray(json))
      throw new RangeError("Invalid JSON representation of ChangeSet");
    let sections = [], inserted = [];
    for (let i = 0; i < json.length; i++) {
      let part = json[i];
      if (typeof part == "number") {
        sections.push(part, -1);
      } else if (!Array.isArray(part) || typeof part[0] != "number" || part.some((e, i2) => i2 && typeof e != "string")) {
        throw new RangeError("Invalid JSON representation of ChangeSet");
      } else if (part.length == 1) {
        sections.push(part[0], 0);
      } else {
        while (inserted.length < i)
          inserted.push(Text.empty);
        inserted[i] = Text.of(part.slice(1));
        sections.push(part[0], inserted[i].length);
      }
    }
    return new _ChangeSet(sections, inserted);
  }
  /**
  @internal
  */
  static createSet(sections, inserted) {
    return new _ChangeSet(sections, inserted);
  }
};
function addSection(sections, len, ins, forceJoin = false) {
  if (len == 0 && ins <= 0)
    return;
  let last = sections.length - 2;
  if (last >= 0 && ins <= 0 && ins == sections[last + 1])
    sections[last] += len;
  else if (last >= 0 && len == 0 && sections[last] == 0)
    sections[last + 1] += ins;
  else if (forceJoin) {
    sections[last] += len;
    sections[last + 1] += ins;
  } else
    sections.push(len, ins);
}
function addInsert(values, sections, value) {
  if (value.length == 0)
    return;
  let index = sections.length - 2 >> 1;
  if (index < values.length) {
    values[values.length - 1] = values[values.length - 1].append(value);
  } else {
    while (values.length < index)
      values.push(Text.empty);
    values.push(value);
  }
}
function iterChanges(desc, f, individual) {
  let inserted = desc.inserted;
  for (let posA = 0, posB = 0, i = 0; i < desc.sections.length; ) {
    let len = desc.sections[i++], ins = desc.sections[i++];
    if (ins < 0) {
      posA += len;
      posB += len;
    } else {
      let endA = posA, endB = posB, text = Text.empty;
      for (; ; ) {
        endA += len;
        endB += ins;
        if (ins && inserted)
          text = text.append(inserted[i - 2 >> 1]);
        if (individual || i == desc.sections.length || desc.sections[i + 1] < 0)
          break;
        len = desc.sections[i++];
        ins = desc.sections[i++];
      }
      f(posA, endA, posB, endB, text);
      posA = endA;
      posB = endB;
    }
  }
}
function mapSet(setA, setB, before, mkSet = false) {
  let sections = [], insert2 = mkSet ? [] : null;
  let a = new SectionIter(setA), b = new SectionIter(setB);
  for (let inserted = -1; ; ) {
    if (a.done && b.len || b.done && a.len) {
      throw new Error("Mismatched change set lengths");
    } else if (a.ins == -1 && b.ins == -1) {
      let len = Math.min(a.len, b.len);
      addSection(sections, len, -1);
      a.forward(len);
      b.forward(len);
    } else if (b.ins >= 0 && (a.ins < 0 || inserted == a.i || a.off == 0 && (b.len < a.len || b.len == a.len && !before))) {
      let len = b.len;
      addSection(sections, b.ins, -1);
      while (len) {
        let piece = Math.min(a.len, len);
        if (a.ins >= 0 && inserted < a.i && a.len <= piece) {
          addSection(sections, 0, a.ins);
          if (insert2)
            addInsert(insert2, sections, a.text);
          inserted = a.i;
        }
        a.forward(piece);
        len -= piece;
      }
      b.next();
    } else if (a.ins >= 0) {
      let len = 0, left = a.len;
      while (left) {
        if (b.ins == -1) {
          let piece = Math.min(left, b.len);
          len += piece;
          left -= piece;
          b.forward(piece);
        } else if (b.ins == 0 && b.len < left) {
          left -= b.len;
          b.next();
        } else {
          break;
        }
      }
      addSection(sections, len, inserted < a.i ? a.ins : 0);
      if (insert2 && inserted < a.i)
        addInsert(insert2, sections, a.text);
      inserted = a.i;
      a.forward(a.len - left);
    } else if (a.done && b.done) {
      return insert2 ? ChangeSet.createSet(sections, insert2) : ChangeDesc.create(sections);
    } else {
      throw new Error("Mismatched change set lengths");
    }
  }
}
function composeSets(setA, setB, mkSet = false) {
  let sections = [];
  let insert2 = mkSet ? [] : null;
  let a = new SectionIter(setA), b = new SectionIter(setB);
  for (let open = false; ; ) {
    if (a.done && b.done) {
      return insert2 ? ChangeSet.createSet(sections, insert2) : ChangeDesc.create(sections);
    } else if (a.ins == 0) {
      addSection(sections, a.len, 0, open);
      a.next();
    } else if (b.len == 0 && !b.done) {
      addSection(sections, 0, b.ins, open);
      if (insert2)
        addInsert(insert2, sections, b.text);
      b.next();
    } else if (a.done || b.done) {
      throw new Error("Mismatched change set lengths");
    } else {
      let len = Math.min(a.len2, b.len), sectionLen = sections.length;
      if (a.ins == -1) {
        let insB = b.ins == -1 ? -1 : b.off ? 0 : b.ins;
        addSection(sections, len, insB, open);
        if (insert2 && insB)
          addInsert(insert2, sections, b.text);
      } else if (b.ins == -1) {
        addSection(sections, a.off ? 0 : a.len, len, open);
        if (insert2)
          addInsert(insert2, sections, a.textBit(len));
      } else {
        addSection(sections, a.off ? 0 : a.len, b.off ? 0 : b.ins, open);
        if (insert2 && !b.off)
          addInsert(insert2, sections, b.text);
      }
      open = (a.ins > len || b.ins >= 0 && b.len > len) && (open || sections.length > sectionLen);
      a.forward2(len);
      b.forward(len);
    }
  }
}
var SectionIter = class {
  constructor(set) {
    this.set = set;
    this.i = 0;
    this.next();
  }
  next() {
    let { sections } = this.set;
    if (this.i < sections.length) {
      this.len = sections[this.i++];
      this.ins = sections[this.i++];
    } else {
      this.len = 0;
      this.ins = -2;
    }
    this.off = 0;
  }
  get done() {
    return this.ins == -2;
  }
  get len2() {
    return this.ins < 0 ? this.len : this.ins;
  }
  get text() {
    let { inserted } = this.set, index = this.i - 2 >> 1;
    return index >= inserted.length ? Text.empty : inserted[index];
  }
  textBit(len) {
    let { inserted } = this.set, index = this.i - 2 >> 1;
    return index >= inserted.length && !len ? Text.empty : inserted[index].slice(this.off, len == null ? void 0 : this.off + len);
  }
  forward(len) {
    if (len == this.len)
      this.next();
    else {
      this.len -= len;
      this.off += len;
    }
  }
  forward2(len) {
    if (this.ins == -1)
      this.forward(len);
    else if (len == this.ins)
      this.next();
    else {
      this.ins -= len;
      this.off += len;
    }
  }
};
var SelectionRange = class _SelectionRange {
  constructor(from, to, flags) {
    this.from = from;
    this.to = to;
    this.flags = flags;
  }
  /**
  The anchor of the range—the side that doesn't move when you
  extend it.
  */
  get anchor() {
    return this.flags & 32 ? this.to : this.from;
  }
  /**
  The head of the range, which is moved when the range is
  [extended](https://codemirror.net/6/docs/ref/#state.SelectionRange.extend).
  */
  get head() {
    return this.flags & 32 ? this.from : this.to;
  }
  /**
  True when `anchor` and `head` are at the same position.
  */
  get empty() {
    return this.from == this.to;
  }
  /**
  If this is a cursor that is explicitly associated with the
  character on one of its sides, this returns the side. -1 means
  the character before its position, 1 the character after, and 0
  means no association.
  */
  get assoc() {
    return this.flags & 8 ? -1 : this.flags & 16 ? 1 : 0;
  }
  /**
  The bidirectional text level associated with this cursor, if
  any.
  */
  get bidiLevel() {
    let level = this.flags & 7;
    return level == 7 ? null : level;
  }
  /**
  The goal column (stored vertical offset) associated with a
  cursor. This is used to preserve the vertical position when
  [moving](https://codemirror.net/6/docs/ref/#view.EditorView.moveVertically) across
  lines of different length.
  */
  get goalColumn() {
    let value = this.flags >> 6;
    return value == 16777215 ? void 0 : value;
  }
  /**
  Map this range through a change, producing a valid range in the
  updated document.
  */
  map(change, assoc = -1) {
    let from, to;
    if (this.empty) {
      from = to = change.mapPos(this.from, assoc);
    } else {
      from = change.mapPos(this.from, 1);
      to = change.mapPos(this.to, -1);
    }
    return from == this.from && to == this.to ? this : new _SelectionRange(from, to, this.flags);
  }
  /**
  Extend this range to cover at least `from` to `to`.
  */
  extend(from, to = from) {
    if (from <= this.anchor && to >= this.anchor)
      return EditorSelection.range(from, to);
    let head = Math.abs(from - this.anchor) > Math.abs(to - this.anchor) ? from : to;
    return EditorSelection.range(this.anchor, head);
  }
  /**
  Compare this range to another range.
  */
  eq(other, includeAssoc = false) {
    return this.anchor == other.anchor && this.head == other.head && (!includeAssoc || !this.empty || this.assoc == other.assoc);
  }
  /**
  Return a JSON-serializable object representing the range.
  */
  toJSON() {
    return { anchor: this.anchor, head: this.head };
  }
  /**
  Convert a JSON representation of a range to a `SelectionRange`
  instance.
  */
  static fromJSON(json) {
    if (!json || typeof json.anchor != "number" || typeof json.head != "number")
      throw new RangeError("Invalid JSON representation for SelectionRange");
    return EditorSelection.range(json.anchor, json.head);
  }
  /**
  @internal
  */
  static create(from, to, flags) {
    return new _SelectionRange(from, to, flags);
  }
};
var EditorSelection = class _EditorSelection {
  constructor(ranges, mainIndex) {
    this.ranges = ranges;
    this.mainIndex = mainIndex;
  }
  /**
  Map a selection through a change. Used to adjust the selection
  position for changes.
  */
  map(change, assoc = -1) {
    if (change.empty)
      return this;
    return _EditorSelection.create(this.ranges.map((r) => r.map(change, assoc)), this.mainIndex);
  }
  /**
  Compare this selection to another selection. By default, ranges
  are compared only by position. When `includeAssoc` is true,
  cursor ranges must also have the same
  [`assoc`](https://codemirror.net/6/docs/ref/#state.SelectionRange.assoc) value.
  */
  eq(other, includeAssoc = false) {
    if (this.ranges.length != other.ranges.length || this.mainIndex != other.mainIndex)
      return false;
    for (let i = 0; i < this.ranges.length; i++)
      if (!this.ranges[i].eq(other.ranges[i], includeAssoc))
        return false;
    return true;
  }
  /**
  Get the primary selection range. Usually, you should make sure
  your code applies to _all_ ranges, by using methods like
  [`changeByRange`](https://codemirror.net/6/docs/ref/#state.EditorState.changeByRange).
  */
  get main() {
    return this.ranges[this.mainIndex];
  }
  /**
  Make sure the selection only has one range. Returns a selection
  holding only the main range from this selection.
  */
  asSingle() {
    return this.ranges.length == 1 ? this : new _EditorSelection([this.main], 0);
  }
  /**
  Extend this selection with an extra range.
  */
  addRange(range, main = true) {
    return _EditorSelection.create([range].concat(this.ranges), main ? 0 : this.mainIndex + 1);
  }
  /**
  Replace a given range with another range, and then normalize the
  selection to merge and sort ranges if necessary.
  */
  replaceRange(range, which = this.mainIndex) {
    let ranges = this.ranges.slice();
    ranges[which] = range;
    return _EditorSelection.create(ranges, this.mainIndex);
  }
  /**
  Convert this selection to an object that can be serialized to
  JSON.
  */
  toJSON() {
    return { ranges: this.ranges.map((r) => r.toJSON()), main: this.mainIndex };
  }
  /**
  Create a selection from a JSON representation.
  */
  static fromJSON(json) {
    if (!json || !Array.isArray(json.ranges) || typeof json.main != "number" || json.main >= json.ranges.length)
      throw new RangeError("Invalid JSON representation for EditorSelection");
    return new _EditorSelection(json.ranges.map((r) => SelectionRange.fromJSON(r)), json.main);
  }
  /**
  Create a selection holding a single range.
  */
  static single(anchor, head = anchor) {
    return new _EditorSelection([_EditorSelection.range(anchor, head)], 0);
  }
  /**
  Sort and merge the given set of ranges, creating a valid
  selection.
  */
  static create(ranges, mainIndex = 0) {
    if (ranges.length == 0)
      throw new RangeError("A selection needs at least one range");
    for (let pos = 0, i = 0; i < ranges.length; i++) {
      let range = ranges[i];
      if (range.empty ? range.from <= pos : range.from < pos)
        return _EditorSelection.normalized(ranges.slice(), mainIndex);
      pos = range.to;
    }
    return new _EditorSelection(ranges, mainIndex);
  }
  /**
  Create a cursor selection range at the given position. You can
  safely ignore the optional arguments in most situations.
  */
  static cursor(pos, assoc = 0, bidiLevel, goalColumn) {
    return SelectionRange.create(pos, pos, (assoc == 0 ? 0 : assoc < 0 ? 8 : 16) | (bidiLevel == null ? 7 : Math.min(6, bidiLevel)) | (goalColumn !== null && goalColumn !== void 0 ? goalColumn : 16777215) << 6);
  }
  /**
  Create a selection range.
  */
  static range(anchor, head, goalColumn, bidiLevel) {
    let flags = (goalColumn !== null && goalColumn !== void 0 ? goalColumn : 16777215) << 6 | (bidiLevel == null ? 7 : Math.min(6, bidiLevel));
    return head < anchor ? SelectionRange.create(head, anchor, 32 | 16 | flags) : SelectionRange.create(anchor, head, (head > anchor ? 8 : 0) | flags);
  }
  /**
  @internal
  */
  static normalized(ranges, mainIndex = 0) {
    let main = ranges[mainIndex];
    ranges.sort((a, b) => a.from - b.from);
    mainIndex = ranges.indexOf(main);
    for (let i = 1; i < ranges.length; i++) {
      let range = ranges[i], prev = ranges[i - 1];
      if (range.empty ? range.from <= prev.to : range.from < prev.to) {
        let from = prev.from, to = Math.max(range.to, prev.to);
        if (i <= mainIndex)
          mainIndex--;
        ranges.splice(--i, 2, range.anchor > range.head ? _EditorSelection.range(to, from) : _EditorSelection.range(from, to));
      }
    }
    return new _EditorSelection(ranges, mainIndex);
  }
};
function checkSelection(selection, docLength) {
  for (let range of selection.ranges)
    if (range.to > docLength)
      throw new RangeError("Selection points outside of document");
}
var nextID = 0;
var Facet = class _Facet {
  constructor(combine, compareInput, compare2, isStatic, enables) {
    this.combine = combine;
    this.compareInput = compareInput;
    this.compare = compare2;
    this.isStatic = isStatic;
    this.id = nextID++;
    this.default = combine([]);
    this.extensions = typeof enables == "function" ? enables(this) : enables;
  }
  /**
  Returns a facet reader for this facet, which can be used to
  [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
  */
  get reader() {
    return this;
  }
  /**
  Define a new facet.
  */
  static define(config = {}) {
    return new _Facet(config.combine || ((a) => a), config.compareInput || ((a, b) => a === b), config.compare || (!config.combine ? sameArray : (a, b) => a === b), !!config.static, config.enables);
  }
  /**
  Returns an extension that adds the given value to this facet.
  */
  of(value) {
    return new FacetProvider([], this, 0, value);
  }
  /**
  Create an extension that computes a value for the facet from a
  state. You must take care to declare the parts of the state that
  this value depends on, since your function is only called again
  for a new state when one of those parts changed.
  
  In cases where your value depends only on a single field, you'll
  want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
  */
  compute(deps, get) {
    if (this.isStatic)
      throw new Error("Can't compute a static facet");
    return new FacetProvider(deps, this, 1, get);
  }
  /**
  Create an extension that computes zero or more values for this
  facet from a state.
  */
  computeN(deps, get) {
    if (this.isStatic)
      throw new Error("Can't compute a static facet");
    return new FacetProvider(deps, this, 2, get);
  }
  from(field, get) {
    if (!get)
      get = (x) => x;
    return this.compute([field], (state) => get(state.field(field)));
  }
};
function sameArray(a, b) {
  return a == b || a.length == b.length && a.every((e, i) => e === b[i]);
}
var FacetProvider = class {
  constructor(dependencies, facet, type, value) {
    this.dependencies = dependencies;
    this.facet = facet;
    this.type = type;
    this.value = value;
    this.id = nextID++;
  }
  dynamicSlot(addresses) {
    var _a;
    let getter = this.value;
    let compare2 = this.facet.compareInput;
    let id = this.id, idx = addresses[id] >> 1, multi = this.type == 2;
    let depDoc = false, depSel = false, depAddrs = [];
    for (let dep of this.dependencies) {
      if (dep == "doc")
        depDoc = true;
      else if (dep == "selection")
        depSel = true;
      else if ((((_a = addresses[dep.id]) !== null && _a !== void 0 ? _a : 1) & 1) == 0)
        depAddrs.push(addresses[dep.id]);
    }
    return {
      create(state) {
        state.values[idx] = getter(state);
        return 1;
      },
      update(state, tr) {
        if (depDoc && tr.docChanged || depSel && (tr.docChanged || tr.selection) || ensureAll(state, depAddrs)) {
          let newVal = getter(state);
          if (multi ? !compareArray(newVal, state.values[idx], compare2) : !compare2(newVal, state.values[idx])) {
            state.values[idx] = newVal;
            return 1;
          }
        }
        return 0;
      },
      reconfigure: (state, oldState) => {
        let newVal, oldAddr = oldState.config.address[id];
        if (oldAddr != null) {
          let oldVal = getAddr(oldState, oldAddr);
          if (this.dependencies.every((dep) => {
            return dep instanceof Facet ? oldState.facet(dep) === state.facet(dep) : dep instanceof StateField ? oldState.field(dep, false) == state.field(dep, false) : true;
          }) || (multi ? compareArray(newVal = getter(state), oldVal, compare2) : compare2(newVal = getter(state), oldVal))) {
            state.values[idx] = oldVal;
            return 0;
          }
        } else {
          newVal = getter(state);
        }
        state.values[idx] = newVal;
        return 1;
      }
    };
  }
};
function compareArray(a, b, compare2) {
  if (a.length != b.length)
    return false;
  for (let i = 0; i < a.length; i++)
    if (!compare2(a[i], b[i]))
      return false;
  return true;
}
function ensureAll(state, addrs) {
  let changed = false;
  for (let addr of addrs)
    if (ensureAddr(state, addr) & 1)
      changed = true;
  return changed;
}
function dynamicFacetSlot(addresses, facet, providers) {
  let providerAddrs = providers.map((p) => addresses[p.id]);
  let providerTypes = providers.map((p) => p.type);
  let dynamic = providerAddrs.filter((p) => !(p & 1));
  let idx = addresses[facet.id] >> 1;
  function get(state) {
    let values = [];
    for (let i = 0; i < providerAddrs.length; i++) {
      let value = getAddr(state, providerAddrs[i]);
      if (providerTypes[i] == 2)
        for (let val of value)
          values.push(val);
      else
        values.push(value);
    }
    return facet.combine(values);
  }
  return {
    create(state) {
      for (let addr of providerAddrs)
        ensureAddr(state, addr);
      state.values[idx] = get(state);
      return 1;
    },
    update(state, tr) {
      if (!ensureAll(state, dynamic))
        return 0;
      let value = get(state);
      if (facet.compare(value, state.values[idx]))
        return 0;
      state.values[idx] = value;
      return 1;
    },
    reconfigure(state, oldState) {
      let depChanged = ensureAll(state, providerAddrs);
      let oldProviders = oldState.config.facets[facet.id], oldValue = oldState.facet(facet);
      if (oldProviders && !depChanged && sameArray(providers, oldProviders)) {
        state.values[idx] = oldValue;
        return 0;
      }
      let value = get(state);
      if (facet.compare(value, oldValue)) {
        state.values[idx] = oldValue;
        return 0;
      }
      state.values[idx] = value;
      return 1;
    }
  };
}
var initField = /* @__PURE__ */ Facet.define({ static: true });
var StateField = class _StateField {
  constructor(id, createF, updateF, compareF, spec) {
    this.id = id;
    this.createF = createF;
    this.updateF = updateF;
    this.compareF = compareF;
    this.spec = spec;
    this.provides = void 0;
  }
  /**
  Define a state field.
  */
  static define(config) {
    let field = new _StateField(nextID++, config.create, config.update, config.compare || ((a, b) => a === b), config);
    if (config.provide)
      field.provides = config.provide(field);
    return field;
  }
  create(state) {
    let init = state.facet(initField).find((i) => i.field == this);
    return ((init === null || init === void 0 ? void 0 : init.create) || this.createF)(state);
  }
  /**
  @internal
  */
  slot(addresses) {
    let idx = addresses[this.id] >> 1;
    return {
      create: (state) => {
        state.values[idx] = this.create(state);
        return 1;
      },
      update: (state, tr) => {
        let oldVal = state.values[idx];
        let value = this.updateF(oldVal, tr);
        if (this.compareF(oldVal, value))
          return 0;
        state.values[idx] = value;
        return 1;
      },
      reconfigure: (state, oldState) => {
        if (oldState.config.address[this.id] != null) {
          state.values[idx] = oldState.field(this);
          return 0;
        }
        state.values[idx] = this.create(state);
        return 1;
      }
    };
  }
  /**
  Returns an extension that enables this field and overrides the
  way it is initialized. Can be useful when you need to provide a
  non-default starting value for the field.
  */
  init(create) {
    return [this, initField.of({ field: this, create })];
  }
  /**
  State field instances can be used as
  [`Extension`](https://codemirror.net/6/docs/ref/#state.Extension) values to enable the field in a
  given state.
  */
  get extension() {
    return this;
  }
};
var Prec_ = { lowest: 4, low: 3, default: 2, high: 1, highest: 0 };
function prec(value) {
  return (ext) => new PrecExtension(ext, value);
}
var Prec = {
  /**
  The highest precedence level, for extensions that should end up
  near the start of the precedence ordering.
  */
  highest: /* @__PURE__ */ prec(Prec_.highest),
  /**
  A higher-than-default precedence, for extensions that should
  come before those with default precedence.
  */
  high: /* @__PURE__ */ prec(Prec_.high),
  /**
  The default precedence, which is also used for extensions
  without an explicit precedence.
  */
  default: /* @__PURE__ */ prec(Prec_.default),
  /**
  A lower-than-default precedence.
  */
  low: /* @__PURE__ */ prec(Prec_.low),
  /**
  The lowest precedence level. Meant for things that should end up
  near the end of the extension order.
  */
  lowest: /* @__PURE__ */ prec(Prec_.lowest)
};
var PrecExtension = class {
  constructor(inner, prec2) {
    this.inner = inner;
    this.prec = prec2;
  }
};
var Compartment = class _Compartment {
  /**
  Create an instance of this compartment to add to your [state
  configuration](https://codemirror.net/6/docs/ref/#state.EditorStateConfig.extensions).
  */
  of(ext) {
    return new CompartmentInstance(this, ext);
  }
  /**
  Create an [effect](https://codemirror.net/6/docs/ref/#state.TransactionSpec.effects) that
  reconfigures this compartment.
  */
  reconfigure(content) {
    return _Compartment.reconfigure.of({ compartment: this, extension: content });
  }
  /**
  Get the current content of the compartment in the state, or
  `undefined` if it isn't present.
  */
  get(state) {
    return state.config.compartments.get(this);
  }
};
var CompartmentInstance = class {
  constructor(compartment, inner) {
    this.compartment = compartment;
    this.inner = inner;
  }
};
var Configuration = class _Configuration {
  constructor(base, compartments, dynamicSlots, address, staticValues, facets) {
    this.base = base;
    this.compartments = compartments;
    this.dynamicSlots = dynamicSlots;
    this.address = address;
    this.staticValues = staticValues;
    this.facets = facets;
    this.statusTemplate = [];
    while (this.statusTemplate.length < dynamicSlots.length)
      this.statusTemplate.push(
        0
        /* SlotStatus.Unresolved */
      );
  }
  staticFacet(facet) {
    let addr = this.address[facet.id];
    return addr == null ? facet.default : this.staticValues[addr >> 1];
  }
  static resolve(base, compartments, oldState) {
    let fields = [];
    let facets = /* @__PURE__ */ Object.create(null);
    let newCompartments = /* @__PURE__ */ new Map();
    for (let ext of flatten(base, compartments, newCompartments)) {
      if (ext instanceof StateField)
        fields.push(ext);
      else
        (facets[ext.facet.id] || (facets[ext.facet.id] = [])).push(ext);
    }
    let address = /* @__PURE__ */ Object.create(null);
    let staticValues = [];
    let dynamicSlots = [];
    for (let field of fields) {
      address[field.id] = dynamicSlots.length << 1;
      dynamicSlots.push((a) => field.slot(a));
    }
    let oldFacets = oldState === null || oldState === void 0 ? void 0 : oldState.config.facets;
    for (let id in facets) {
      let providers = facets[id], facet = providers[0].facet;
      let oldProviders = oldFacets && oldFacets[id] || [];
      if (providers.every(
        (p) => p.type == 0
        /* Provider.Static */
      )) {
        address[facet.id] = staticValues.length << 1 | 1;
        if (sameArray(oldProviders, providers)) {
          staticValues.push(oldState.facet(facet));
        } else {
          let value = facet.combine(providers.map((p) => p.value));
          staticValues.push(oldState && facet.compare(value, oldState.facet(facet)) ? oldState.facet(facet) : value);
        }
      } else {
        for (let p of providers) {
          if (p.type == 0) {
            address[p.id] = staticValues.length << 1 | 1;
            staticValues.push(p.value);
          } else {
            address[p.id] = dynamicSlots.length << 1;
            dynamicSlots.push((a) => p.dynamicSlot(a));
          }
        }
        address[facet.id] = dynamicSlots.length << 1;
        dynamicSlots.push((a) => dynamicFacetSlot(a, facet, providers));
      }
    }
    let dynamic = dynamicSlots.map((f) => f(address));
    return new _Configuration(base, newCompartments, dynamic, address, staticValues, facets);
  }
};
function flatten(extension, compartments, newCompartments) {
  let result = [[], [], [], [], []];
  let seen = /* @__PURE__ */ new Map();
  function inner(ext, prec2) {
    let known = seen.get(ext);
    if (known != null) {
      if (known <= prec2)
        return;
      let found = result[known].indexOf(ext);
      if (found > -1)
        result[known].splice(found, 1);
      if (ext instanceof CompartmentInstance)
        newCompartments.delete(ext.compartment);
    }
    seen.set(ext, prec2);
    if (Array.isArray(ext)) {
      for (let e of ext)
        inner(e, prec2);
    } else if (ext instanceof CompartmentInstance) {
      if (newCompartments.has(ext.compartment))
        throw new RangeError(`Duplicate use of compartment in extensions`);
      let content = compartments.get(ext.compartment) || ext.inner;
      newCompartments.set(ext.compartment, content);
      inner(content, prec2);
    } else if (ext instanceof PrecExtension) {
      inner(ext.inner, ext.prec);
    } else if (ext instanceof StateField) {
      result[prec2].push(ext);
      if (ext.provides)
        inner(ext.provides, prec2);
    } else if (ext instanceof FacetProvider) {
      result[prec2].push(ext);
      if (ext.facet.extensions)
        inner(ext.facet.extensions, Prec_.default);
    } else {
      let content = ext.extension;
      if (!content)
        throw new Error(`Unrecognized extension value in extension set (${ext}). This sometimes happens because multiple instances of @codemirror/state are loaded, breaking instanceof checks.`);
      inner(content, prec2);
    }
  }
  inner(extension, Prec_.default);
  return result.reduce((a, b) => a.concat(b));
}
function ensureAddr(state, addr) {
  if (addr & 1)
    return 2;
  let idx = addr >> 1;
  let status = state.status[idx];
  if (status == 4)
    throw new Error("Cyclic dependency between fields and/or facets");
  if (status & 2)
    return status;
  state.status[idx] = 4;
  let changed = state.computeSlot(state, state.config.dynamicSlots[idx]);
  return state.status[idx] = 2 | changed;
}
function getAddr(state, addr) {
  return addr & 1 ? state.config.staticValues[addr >> 1] : state.values[addr >> 1];
}
var languageData = /* @__PURE__ */ Facet.define();
var allowMultipleSelections = /* @__PURE__ */ Facet.define({
  combine: (values) => values.some((v) => v),
  static: true
});
var lineSeparator = /* @__PURE__ */ Facet.define({
  combine: (values) => values.length ? values[0] : void 0,
  static: true
});
var changeFilter = /* @__PURE__ */ Facet.define();
var transactionFilter = /* @__PURE__ */ Facet.define();
var transactionExtender = /* @__PURE__ */ Facet.define();
var readOnly = /* @__PURE__ */ Facet.define({
  combine: (values) => values.length ? values[0] : false
});
var Annotation = class {
  /**
  @internal
  */
  constructor(type, value) {
    this.type = type;
    this.value = value;
  }
  /**
  Define a new type of annotation.
  */
  static define() {
    return new AnnotationType();
  }
};
var AnnotationType = class {
  /**
  Create an instance of this annotation.
  */
  of(value) {
    return new Annotation(this, value);
  }
};
var StateEffectType = class {
  /**
  @internal
  */
  constructor(map) {
    this.map = map;
  }
  /**
  Create a [state effect](https://codemirror.net/6/docs/ref/#state.StateEffect) instance of this
  type.
  */
  of(value) {
    return new StateEffect(this, value);
  }
};
var StateEffect = class _StateEffect {
  /**
  @internal
  */
  constructor(type, value) {
    this.type = type;
    this.value = value;
  }
  /**
  Map this effect through a position mapping. Will return
  `undefined` when that ends up deleting the effect.
  */
  map(mapping) {
    let mapped = this.type.map(this.value, mapping);
    return mapped === void 0 ? void 0 : mapped == this.value ? this : new _StateEffect(this.type, mapped);
  }
  /**
  Tells you whether this effect object is of a given
  [type](https://codemirror.net/6/docs/ref/#state.StateEffectType).
  */
  is(type) {
    return this.type == type;
  }
  /**
  Define a new effect type. The type parameter indicates the type
  of values that his effect holds. It should be a type that
  doesn't include `undefined`, since that is used in
  [mapping](https://codemirror.net/6/docs/ref/#state.StateEffect.map) to indicate that an effect is
  removed.
  */
  static define(spec = {}) {
    return new StateEffectType(spec.map || ((v) => v));
  }
  /**
  Map an array of effects through a change set.
  */
  static mapEffects(effects, mapping) {
    if (!effects.length)
      return effects;
    let result = [];
    for (let effect of effects) {
      let mapped = effect.map(mapping);
      if (mapped)
        result.push(mapped);
    }
    return result;
  }
};
StateEffect.reconfigure = /* @__PURE__ */ StateEffect.define();
StateEffect.appendConfig = /* @__PURE__ */ StateEffect.define();
var Transaction = class _Transaction {
  constructor(startState, changes, selection, effects, annotations, scrollIntoView) {
    this.startState = startState;
    this.changes = changes;
    this.selection = selection;
    this.effects = effects;
    this.annotations = annotations;
    this.scrollIntoView = scrollIntoView;
    this._doc = null;
    this._state = null;
    if (selection)
      checkSelection(selection, changes.newLength);
    if (!annotations.some((a) => a.type == _Transaction.time))
      this.annotations = annotations.concat(_Transaction.time.of(Date.now()));
  }
  /**
  @internal
  */
  static create(startState, changes, selection, effects, annotations, scrollIntoView) {
    return new _Transaction(startState, changes, selection, effects, annotations, scrollIntoView);
  }
  /**
  The new document produced by the transaction. Contrary to
  [`.state`](https://codemirror.net/6/docs/ref/#state.Transaction.state)`.doc`, accessing this won't
  force the entire new state to be computed right away, so it is
  recommended that [transaction
  filters](https://codemirror.net/6/docs/ref/#state.EditorState^transactionFilter) use this getter
  when they need to look at the new document.
  */
  get newDoc() {
    return this._doc || (this._doc = this.changes.apply(this.startState.doc));
  }
  /**
  The new selection produced by the transaction. If
  [`this.selection`](https://codemirror.net/6/docs/ref/#state.Transaction.selection) is undefined,
  this will [map](https://codemirror.net/6/docs/ref/#state.EditorSelection.map) the start state's
  current selection through the changes made by the transaction.
  */
  get newSelection() {
    return this.selection || this.startState.selection.map(this.changes);
  }
  /**
  The new state created by the transaction. Computed on demand
  (but retained for subsequent access), so it is recommended not to
  access it in [transaction
  filters](https://codemirror.net/6/docs/ref/#state.EditorState^transactionFilter) when possible.
  */
  get state() {
    if (!this._state)
      this.startState.applyTransaction(this);
    return this._state;
  }
  /**
  Get the value of the given annotation type, if any.
  */
  annotation(type) {
    for (let ann of this.annotations)
      if (ann.type == type)
        return ann.value;
    return void 0;
  }
  /**
  Indicates whether the transaction changed the document.
  */
  get docChanged() {
    return !this.changes.empty;
  }
  /**
  Indicates whether this transaction reconfigures the state
  (through a [configuration compartment](https://codemirror.net/6/docs/ref/#state.Compartment) or
  with a top-level configuration
  [effect](https://codemirror.net/6/docs/ref/#state.StateEffect^reconfigure).
  */
  get reconfigured() {
    return this.startState.config != this.state.config;
  }
  /**
  Returns true if the transaction has a [user
  event](https://codemirror.net/6/docs/ref/#state.Transaction^userEvent) annotation that is equal to
  or more specific than `event`. For example, if the transaction
  has `"select.pointer"` as user event, `"select"` and
  `"select.pointer"` will match it.
  */
  isUserEvent(event) {
    let e = this.annotation(_Transaction.userEvent);
    return !!(e && (e == event || e.length > event.length && e.slice(0, event.length) == event && e[event.length] == "."));
  }
};
Transaction.time = /* @__PURE__ */ Annotation.define();
Transaction.userEvent = /* @__PURE__ */ Annotation.define();
Transaction.addToHistory = /* @__PURE__ */ Annotation.define();
Transaction.remote = /* @__PURE__ */ Annotation.define();
function joinRanges(a, b) {
  let result = [];
  for (let iA = 0, iB = 0; ; ) {
    let from, to;
    if (iA < a.length && (iB == b.length || b[iB] >= a[iA])) {
      from = a[iA++];
      to = a[iA++];
    } else if (iB < b.length) {
      from = b[iB++];
      to = b[iB++];
    } else
      return result;
    if (!result.length || result[result.length - 1] < from)
      result.push(from, to);
    else if (result[result.length - 1] < to)
      result[result.length - 1] = to;
  }
}
function mergeTransaction(a, b, sequential) {
  var _a;
  let mapForA, mapForB, changes;
  if (sequential) {
    mapForA = b.changes;
    mapForB = ChangeSet.empty(b.changes.length);
    changes = a.changes.compose(b.changes);
  } else {
    mapForA = b.changes.map(a.changes);
    mapForB = a.changes.mapDesc(b.changes, true);
    changes = a.changes.compose(mapForA);
  }
  return {
    changes,
    selection: b.selection ? b.selection.map(mapForB) : (_a = a.selection) === null || _a === void 0 ? void 0 : _a.map(mapForA),
    effects: StateEffect.mapEffects(a.effects, mapForA).concat(StateEffect.mapEffects(b.effects, mapForB)),
    annotations: a.annotations.length ? a.annotations.concat(b.annotations) : b.annotations,
    scrollIntoView: a.scrollIntoView || b.scrollIntoView
  };
}
function resolveTransactionInner(state, spec, docSize) {
  let sel = spec.selection, annotations = asArray(spec.annotations);
  if (spec.userEvent)
    annotations = annotations.concat(Transaction.userEvent.of(spec.userEvent));
  return {
    changes: spec.changes instanceof ChangeSet ? spec.changes : ChangeSet.of(spec.changes || [], docSize, state.facet(lineSeparator)),
    selection: sel && (sel instanceof EditorSelection ? sel : EditorSelection.single(sel.anchor, sel.head)),
    effects: asArray(spec.effects),
    annotations,
    scrollIntoView: !!spec.scrollIntoView
  };
}
function resolveTransaction(state, specs, filter) {
  let s = resolveTransactionInner(state, specs.length ? specs[0] : {}, state.doc.length);
  if (specs.length && specs[0].filter === false)
    filter = false;
  for (let i = 1; i < specs.length; i++) {
    if (specs[i].filter === false)
      filter = false;
    let seq = !!specs[i].sequential;
    s = mergeTransaction(s, resolveTransactionInner(state, specs[i], seq ? s.changes.newLength : state.doc.length), seq);
  }
  let tr = Transaction.create(state, s.changes, s.selection, s.effects, s.annotations, s.scrollIntoView);
  return extendTransaction(filter ? filterTransaction(tr) : tr);
}
function filterTransaction(tr) {
  let state = tr.startState;
  let result = true;
  for (let filter of state.facet(changeFilter)) {
    let value = filter(tr);
    if (value === false) {
      result = false;
      break;
    }
    if (Array.isArray(value))
      result = result === true ? value : joinRanges(result, value);
  }
  if (result !== true) {
    let changes, back;
    if (result === false) {
      back = tr.changes.invertedDesc;
      changes = ChangeSet.empty(state.doc.length);
    } else {
      let filtered = tr.changes.filter(result);
      changes = filtered.changes;
      back = filtered.filtered.mapDesc(filtered.changes).invertedDesc;
    }
    tr = Transaction.create(state, changes, tr.selection && tr.selection.map(back), StateEffect.mapEffects(tr.effects, back), tr.annotations, tr.scrollIntoView);
  }
  let filters = state.facet(transactionFilter);
  for (let i = filters.length - 1; i >= 0; i--) {
    let filtered = filters[i](tr);
    if (filtered instanceof Transaction)
      tr = filtered;
    else if (Array.isArray(filtered) && filtered.length == 1 && filtered[0] instanceof Transaction)
      tr = filtered[0];
    else
      tr = resolveTransaction(state, asArray(filtered), false);
  }
  return tr;
}
function extendTransaction(tr) {
  let state = tr.startState, extenders = state.facet(transactionExtender), spec = tr;
  for (let i = extenders.length - 1; i >= 0; i--) {
    let extension = extenders[i](tr);
    if (extension && Object.keys(extension).length)
      spec = mergeTransaction(spec, resolveTransactionInner(state, extension, tr.changes.newLength), true);
  }
  return spec == tr ? tr : Transaction.create(state, tr.changes, tr.selection, spec.effects, spec.annotations, spec.scrollIntoView);
}
var none = [];
function asArray(value) {
  return value == null ? none : Array.isArray(value) ? value : [value];
}
var CharCategory = /* @__PURE__ */ function(CharCategory2) {
  CharCategory2[CharCategory2["Word"] = 0] = "Word";
  CharCategory2[CharCategory2["Space"] = 1] = "Space";
  CharCategory2[CharCategory2["Other"] = 2] = "Other";
  return CharCategory2;
}(CharCategory || (CharCategory = {}));
var nonASCIISingleCaseWordChar = /[\u00df\u0587\u0590-\u05f4\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc\uac00-\ud7af]/;
var wordChar;
try {
  wordChar = /* @__PURE__ */ new RegExp("[\\p{Alphabetic}\\p{Number}_]", "u");
} catch (_) {
}
function hasWordChar(str) {
  if (wordChar)
    return wordChar.test(str);
  for (let i = 0; i < str.length; i++) {
    let ch = str[i];
    if (/\w/.test(ch) || ch > "\x80" && (ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch)))
      return true;
  }
  return false;
}
function makeCategorizer(wordChars) {
  return (char) => {
    if (!/\S/.test(char))
      return CharCategory.Space;
    if (hasWordChar(char))
      return CharCategory.Word;
    for (let i = 0; i < wordChars.length; i++)
      if (char.indexOf(wordChars[i]) > -1)
        return CharCategory.Word;
    return CharCategory.Other;
  };
}
var EditorState = class _EditorState {
  constructor(config, doc, selection, values, computeSlot, tr) {
    this.config = config;
    this.doc = doc;
    this.selection = selection;
    this.values = values;
    this.status = config.statusTemplate.slice();
    this.computeSlot = computeSlot;
    if (tr)
      tr._state = this;
    for (let i = 0; i < this.config.dynamicSlots.length; i++)
      ensureAddr(this, i << 1);
    this.computeSlot = null;
  }
  field(field, require2 = true) {
    let addr = this.config.address[field.id];
    if (addr == null) {
      if (require2)
        throw new RangeError("Field is not present in this state");
      return void 0;
    }
    ensureAddr(this, addr);
    return getAddr(this, addr);
  }
  /**
  Create a [transaction](https://codemirror.net/6/docs/ref/#state.Transaction) that updates this
  state. Any number of [transaction specs](https://codemirror.net/6/docs/ref/#state.TransactionSpec)
  can be passed. Unless
  [`sequential`](https://codemirror.net/6/docs/ref/#state.TransactionSpec.sequential) is set, the
  [changes](https://codemirror.net/6/docs/ref/#state.TransactionSpec.changes) (if any) of each spec
  are assumed to start in the _current_ document (not the document
  produced by previous specs), and its
  [selection](https://codemirror.net/6/docs/ref/#state.TransactionSpec.selection) and
  [effects](https://codemirror.net/6/docs/ref/#state.TransactionSpec.effects) are assumed to refer
  to the document created by its _own_ changes. The resulting
  transaction contains the combined effect of all the different
  specs. For [selection](https://codemirror.net/6/docs/ref/#state.TransactionSpec.selection), later
  specs take precedence over earlier ones.
  */
  update(...specs) {
    return resolveTransaction(this, specs, true);
  }
  /**
  @internal
  */
  applyTransaction(tr) {
    let conf = this.config, { base, compartments } = conf;
    for (let effect of tr.effects) {
      if (effect.is(Compartment.reconfigure)) {
        if (conf) {
          compartments = /* @__PURE__ */ new Map();
          conf.compartments.forEach((val, key) => compartments.set(key, val));
          conf = null;
        }
        compartments.set(effect.value.compartment, effect.value.extension);
      } else if (effect.is(StateEffect.reconfigure)) {
        conf = null;
        base = effect.value;
      } else if (effect.is(StateEffect.appendConfig)) {
        conf = null;
        base = asArray(base).concat(effect.value);
      }
    }
    let startValues;
    if (!conf) {
      conf = Configuration.resolve(base, compartments, this);
      let intermediateState = new _EditorState(conf, this.doc, this.selection, conf.dynamicSlots.map(() => null), (state, slot) => slot.reconfigure(state, this), null);
      startValues = intermediateState.values;
    } else {
      startValues = tr.startState.values.slice();
    }
    let selection = tr.startState.facet(allowMultipleSelections) ? tr.newSelection : tr.newSelection.asSingle();
    new _EditorState(conf, tr.newDoc, selection, startValues, (state, slot) => slot.update(state, tr), tr);
  }
  /**
  Create a [transaction spec](https://codemirror.net/6/docs/ref/#state.TransactionSpec) that
  replaces every selection range with the given content.
  */
  replaceSelection(text) {
    if (typeof text == "string")
      text = this.toText(text);
    return this.changeByRange((range) => ({
      changes: { from: range.from, to: range.to, insert: text },
      range: EditorSelection.cursor(range.from + text.length)
    }));
  }
  /**
  Create a set of changes and a new selection by running the given
  function for each range in the active selection. The function
  can return an optional set of changes (in the coordinate space
  of the start document), plus an updated range (in the coordinate
  space of the document produced by the call's own changes). This
  method will merge all the changes and ranges into a single
  changeset and selection, and return it as a [transaction
  spec](https://codemirror.net/6/docs/ref/#state.TransactionSpec), which can be passed to
  [`update`](https://codemirror.net/6/docs/ref/#state.EditorState.update).
  */
  changeByRange(f) {
    let sel = this.selection;
    let result1 = f(sel.ranges[0]);
    let changes = this.changes(result1.changes), ranges = [result1.range];
    let effects = asArray(result1.effects);
    for (let i = 1; i < sel.ranges.length; i++) {
      let result = f(sel.ranges[i]);
      let newChanges = this.changes(result.changes), newMapped = newChanges.map(changes);
      for (let j = 0; j < i; j++)
        ranges[j] = ranges[j].map(newMapped);
      let mapBy = changes.mapDesc(newChanges, true);
      ranges.push(result.range.map(mapBy));
      changes = changes.compose(newMapped);
      effects = StateEffect.mapEffects(effects, newMapped).concat(StateEffect.mapEffects(asArray(result.effects), mapBy));
    }
    return {
      changes,
      selection: EditorSelection.create(ranges, sel.mainIndex),
      effects
    };
  }
  /**
  Create a [change set](https://codemirror.net/6/docs/ref/#state.ChangeSet) from the given change
  description, taking the state's document length and line
  separator into account.
  */
  changes(spec = []) {
    if (spec instanceof ChangeSet)
      return spec;
    return ChangeSet.of(spec, this.doc.length, this.facet(_EditorState.lineSeparator));
  }
  /**
  Using the state's [line
  separator](https://codemirror.net/6/docs/ref/#state.EditorState^lineSeparator), create a
  [`Text`](https://codemirror.net/6/docs/ref/#state.Text) instance from the given string.
  */
  toText(string) {
    return Text.of(string.split(this.facet(_EditorState.lineSeparator) || DefaultSplit));
  }
  /**
  Return the given range of the document as a string.
  */
  sliceDoc(from = 0, to = this.doc.length) {
    return this.doc.sliceString(from, to, this.lineBreak);
  }
  /**
  Get the value of a state [facet](https://codemirror.net/6/docs/ref/#state.Facet).
  */
  facet(facet) {
    let addr = this.config.address[facet.id];
    if (addr == null)
      return facet.default;
    ensureAddr(this, addr);
    return getAddr(this, addr);
  }
  /**
  Convert this state to a JSON-serializable object. When custom
  fields should be serialized, you can pass them in as an object
  mapping property names (in the resulting object, which should
  not use `doc` or `selection`) to fields.
  */
  toJSON(fields) {
    let result = {
      doc: this.sliceDoc(),
      selection: this.selection.toJSON()
    };
    if (fields)
      for (let prop in fields) {
        let value = fields[prop];
        if (value instanceof StateField && this.config.address[value.id] != null)
          result[prop] = value.spec.toJSON(this.field(fields[prop]), this);
      }
    return result;
  }
  /**
  Deserialize a state from its JSON representation. When custom
  fields should be deserialized, pass the same object you passed
  to [`toJSON`](https://codemirror.net/6/docs/ref/#state.EditorState.toJSON) when serializing as
  third argument.
  */
  static fromJSON(json, config = {}, fields) {
    if (!json || typeof json.doc != "string")
      throw new RangeError("Invalid JSON representation for EditorState");
    let fieldInit = [];
    if (fields)
      for (let prop in fields) {
        if (Object.prototype.hasOwnProperty.call(json, prop)) {
          let field = fields[prop], value = json[prop];
          fieldInit.push(field.init((state) => field.spec.fromJSON(value, state)));
        }
      }
    return _EditorState.create({
      doc: json.doc,
      selection: EditorSelection.fromJSON(json.selection),
      extensions: config.extensions ? fieldInit.concat([config.extensions]) : fieldInit
    });
  }
  /**
  Create a new state. You'll usually only need this when
  initializing an editor—updated states are created by applying
  transactions.
  */
  static create(config = {}) {
    let configuration = Configuration.resolve(config.extensions || [], /* @__PURE__ */ new Map());
    let doc = config.doc instanceof Text ? config.doc : Text.of((config.doc || "").split(configuration.staticFacet(_EditorState.lineSeparator) || DefaultSplit));
    let selection = !config.selection ? EditorSelection.single(0) : config.selection instanceof EditorSelection ? config.selection : EditorSelection.single(config.selection.anchor, config.selection.head);
    checkSelection(selection, doc.length);
    if (!configuration.staticFacet(allowMultipleSelections))
      selection = selection.asSingle();
    return new _EditorState(configuration, doc, selection, configuration.dynamicSlots.map(() => null), (state, slot) => slot.create(state), null);
  }
  /**
  The size (in columns) of a tab in the document, determined by
  the [`tabSize`](https://codemirror.net/6/docs/ref/#state.EditorState^tabSize) facet.
  */
  get tabSize() {
    return this.facet(_EditorState.tabSize);
  }
  /**
  Get the proper [line-break](https://codemirror.net/6/docs/ref/#state.EditorState^lineSeparator)
  string for this state.
  */
  get lineBreak() {
    return this.facet(_EditorState.lineSeparator) || "\n";
  }
  /**
  Returns true when the editor is
  [configured](https://codemirror.net/6/docs/ref/#state.EditorState^readOnly) to be read-only.
  */
  get readOnly() {
    return this.facet(readOnly);
  }
  /**
  Look up a translation for the given phrase (via the
  [`phrases`](https://codemirror.net/6/docs/ref/#state.EditorState^phrases) facet), or return the
  original string if no translation is found.
  
  If additional arguments are passed, they will be inserted in
  place of markers like `$1` (for the first value) and `$2`, etc.
  A single `$` is equivalent to `$1`, and `$$` will produce a
  literal dollar sign.
  */
  phrase(phrase, ...insert2) {
    for (let map of this.facet(_EditorState.phrases))
      if (Object.prototype.hasOwnProperty.call(map, phrase)) {
        phrase = map[phrase];
        break;
      }
    if (insert2.length)
      phrase = phrase.replace(/\$(\$|\d*)/g, (m, i) => {
        if (i == "$")
          return "$";
        let n = +(i || 1);
        return !n || n > insert2.length ? m : insert2[n - 1];
      });
    return phrase;
  }
  /**
  Find the values for a given language data field, provided by the
  the [`languageData`](https://codemirror.net/6/docs/ref/#state.EditorState^languageData) facet.
  
  Examples of language data fields are...
  
  - [`"commentTokens"`](https://codemirror.net/6/docs/ref/#commands.CommentTokens) for specifying
    comment syntax.
  - [`"autocomplete"`](https://codemirror.net/6/docs/ref/#autocomplete.autocompletion^config.override)
    for providing language-specific completion sources.
  - [`"wordChars"`](https://codemirror.net/6/docs/ref/#state.EditorState.charCategorizer) for adding
    characters that should be considered part of words in this
    language.
  - [`"closeBrackets"`](https://codemirror.net/6/docs/ref/#autocomplete.CloseBracketConfig) controls
    bracket closing behavior.
  */
  languageDataAt(name, pos, side = -1) {
    let values = [];
    for (let provider of this.facet(languageData)) {
      for (let result of provider(this, pos, side)) {
        if (Object.prototype.hasOwnProperty.call(result, name))
          values.push(result[name]);
      }
    }
    return values;
  }
  /**
  Return a function that can categorize strings (expected to
  represent a single [grapheme cluster](https://codemirror.net/6/docs/ref/#state.findClusterBreak))
  into one of:
  
   - Word (contains an alphanumeric character or a character
     explicitly listed in the local language's `"wordChars"`
     language data, which should be a string)
   - Space (contains only whitespace)
   - Other (anything else)
  */
  charCategorizer(at) {
    return makeCategorizer(this.languageDataAt("wordChars", at).join(""));
  }
  /**
  Find the word at the given position, meaning the range
  containing all [word](https://codemirror.net/6/docs/ref/#state.CharCategory.Word) characters
  around it. If no word characters are adjacent to the position,
  this returns null.
  */
  wordAt(pos) {
    let { text, from, length } = this.doc.lineAt(pos);
    let cat = this.charCategorizer(pos);
    let start = pos - from, end = pos - from;
    while (start > 0) {
      let prev = findClusterBreak2(text, start, false);
      if (cat(text.slice(prev, start)) != CharCategory.Word)
        break;
      start = prev;
    }
    while (end < length) {
      let next = findClusterBreak2(text, end);
      if (cat(text.slice(end, next)) != CharCategory.Word)
        break;
      end = next;
    }
    return start == end ? null : EditorSelection.range(start + from, end + from);
  }
};
EditorState.allowMultipleSelections = allowMultipleSelections;
EditorState.tabSize = /* @__PURE__ */ Facet.define({
  combine: (values) => values.length ? values[0] : 4
});
EditorState.lineSeparator = lineSeparator;
EditorState.readOnly = readOnly;
EditorState.phrases = /* @__PURE__ */ Facet.define({
  compare(a, b) {
    let kA = Object.keys(a), kB = Object.keys(b);
    return kA.length == kB.length && kA.every((k) => a[k] == b[k]);
  }
});
EditorState.languageData = languageData;
EditorState.changeFilter = changeFilter;
EditorState.transactionFilter = transactionFilter;
EditorState.transactionExtender = transactionExtender;
Compartment.reconfigure = /* @__PURE__ */ StateEffect.define();
var RangeValue = class {
  /**
  Compare this value with another value. Used when comparing
  rangesets. The default implementation compares by identity.
  Unless you are only creating a fixed number of unique instances
  of your value type, it is a good idea to implement this
  properly.
  */
  eq(other) {
    return this == other;
  }
  /**
  Create a [range](https://codemirror.net/6/docs/ref/#state.Range) with this value.
  */
  range(from, to = from) {
    return Range.create(from, to, this);
  }
};
RangeValue.prototype.startSide = RangeValue.prototype.endSide = 0;
RangeValue.prototype.point = false;
RangeValue.prototype.mapMode = MapMode.TrackDel;
var Range = class _Range {
  constructor(from, to, value) {
    this.from = from;
    this.to = to;
    this.value = value;
  }
  /**
  @internal
  */
  static create(from, to, value) {
    return new _Range(from, to, value);
  }
};
function cmpRange(a, b) {
  return a.from - b.from || a.value.startSide - b.value.startSide;
}
var Chunk = class _Chunk {
  constructor(from, to, value, maxPoint) {
    this.from = from;
    this.to = to;
    this.value = value;
    this.maxPoint = maxPoint;
  }
  get length() {
    return this.to[this.to.length - 1];
  }
  // Find the index of the given position and side. Use the ranges'
  // `from` pos when `end == false`, `to` when `end == true`.
  findIndex(pos, side, end, startAt = 0) {
    let arr = end ? this.to : this.from;
    for (let lo = startAt, hi = arr.length; ; ) {
      if (lo == hi)
        return lo;
      let mid = lo + hi >> 1;
      let diff = arr[mid] - pos || (end ? this.value[mid].endSide : this.value[mid].startSide) - side;
      if (mid == lo)
        return diff >= 0 ? lo : hi;
      if (diff >= 0)
        hi = mid;
      else
        lo = mid + 1;
    }
  }
  between(offset, from, to, f) {
    for (let i = this.findIndex(from, -1e9, true), e = this.findIndex(to, 1e9, false, i); i < e; i++)
      if (f(this.from[i] + offset, this.to[i] + offset, this.value[i]) === false)
        return false;
  }
  map(offset, changes) {
    let value = [], from = [], to = [], newPos = -1, maxPoint = -1;
    for (let i = 0; i < this.value.length; i++) {
      let val = this.value[i], curFrom = this.from[i] + offset, curTo = this.to[i] + offset, newFrom, newTo;
      if (curFrom == curTo) {
        let mapped = changes.mapPos(curFrom, val.startSide, val.mapMode);
        if (mapped == null)
          continue;
        newFrom = newTo = mapped;
        if (val.startSide != val.endSide) {
          newTo = changes.mapPos(curFrom, val.endSide);
          if (newTo < newFrom)
            continue;
        }
      } else {
        newFrom = changes.mapPos(curFrom, val.startSide);
        newTo = changes.mapPos(curTo, val.endSide);
        if (newFrom > newTo || newFrom == newTo && val.startSide > 0 && val.endSide <= 0)
          continue;
      }
      if ((newTo - newFrom || val.endSide - val.startSide) < 0)
        continue;
      if (newPos < 0)
        newPos = newFrom;
      if (val.point)
        maxPoint = Math.max(maxPoint, newTo - newFrom);
      value.push(val);
      from.push(newFrom - newPos);
      to.push(newTo - newPos);
    }
    return { mapped: value.length ? new _Chunk(from, to, value, maxPoint) : null, pos: newPos };
  }
};
var RangeSet = class _RangeSet {
  constructor(chunkPos, chunk, nextLayer, maxPoint) {
    this.chunkPos = chunkPos;
    this.chunk = chunk;
    this.nextLayer = nextLayer;
    this.maxPoint = maxPoint;
  }
  /**
  @internal
  */
  static create(chunkPos, chunk, nextLayer, maxPoint) {
    return new _RangeSet(chunkPos, chunk, nextLayer, maxPoint);
  }
  /**
  @internal
  */
  get length() {
    let last = this.chunk.length - 1;
    return last < 0 ? 0 : Math.max(this.chunkEnd(last), this.nextLayer.length);
  }
  /**
  The number of ranges in the set.
  */
  get size() {
    if (this.isEmpty)
      return 0;
    let size = this.nextLayer.size;
    for (let chunk of this.chunk)
      size += chunk.value.length;
    return size;
  }
  /**
  @internal
  */
  chunkEnd(index) {
    return this.chunkPos[index] + this.chunk[index].length;
  }
  /**
  Update the range set, optionally adding new ranges or filtering
  out existing ones.
  
  (Note: The type parameter is just there as a kludge to work
  around TypeScript variance issues that prevented `RangeSet<X>`
  from being a subtype of `RangeSet<Y>` when `X` is a subtype of
  `Y`.)
  */
  update(updateSpec) {
    let { add = [], sort = false, filterFrom = 0, filterTo = this.length } = updateSpec;
    let filter = updateSpec.filter;
    if (add.length == 0 && !filter)
      return this;
    if (sort)
      add = add.slice().sort(cmpRange);
    if (this.isEmpty)
      return add.length ? _RangeSet.of(add) : this;
    let cur = new LayerCursor(this, null, -1).goto(0), i = 0, spill = [];
    let builder = new RangeSetBuilder();
    while (cur.value || i < add.length) {
      if (i < add.length && (cur.from - add[i].from || cur.startSide - add[i].value.startSide) >= 0) {
        let range = add[i++];
        if (!builder.addInner(range.from, range.to, range.value))
          spill.push(range);
      } else if (cur.rangeIndex == 1 && cur.chunkIndex < this.chunk.length && (i == add.length || this.chunkEnd(cur.chunkIndex) < add[i].from) && (!filter || filterFrom > this.chunkEnd(cur.chunkIndex) || filterTo < this.chunkPos[cur.chunkIndex]) && builder.addChunk(this.chunkPos[cur.chunkIndex], this.chunk[cur.chunkIndex])) {
        cur.nextChunk();
      } else {
        if (!filter || filterFrom > cur.to || filterTo < cur.from || filter(cur.from, cur.to, cur.value)) {
          if (!builder.addInner(cur.from, cur.to, cur.value))
            spill.push(Range.create(cur.from, cur.to, cur.value));
        }
        cur.next();
      }
    }
    return builder.finishInner(this.nextLayer.isEmpty && !spill.length ? _RangeSet.empty : this.nextLayer.update({ add: spill, filter, filterFrom, filterTo }));
  }
  /**
  Map this range set through a set of changes, return the new set.
  */
  map(changes) {
    if (changes.empty || this.isEmpty)
      return this;
    let chunks = [], chunkPos = [], maxPoint = -1;
    for (let i = 0; i < this.chunk.length; i++) {
      let start = this.chunkPos[i], chunk = this.chunk[i];
      let touch = changes.touchesRange(start, start + chunk.length);
      if (touch === false) {
        maxPoint = Math.max(maxPoint, chunk.maxPoint);
        chunks.push(chunk);
        chunkPos.push(changes.mapPos(start));
      } else if (touch === true) {
        let { mapped, pos } = chunk.map(start, changes);
        if (mapped) {
          maxPoint = Math.max(maxPoint, mapped.maxPoint);
          chunks.push(mapped);
          chunkPos.push(pos);
        }
      }
    }
    let next = this.nextLayer.map(changes);
    return chunks.length == 0 ? next : new _RangeSet(chunkPos, chunks, next || _RangeSet.empty, maxPoint);
  }
  /**
  Iterate over the ranges that touch the region `from` to `to`,
  calling `f` for each. There is no guarantee that the ranges will
  be reported in any specific order. When the callback returns
  `false`, iteration stops.
  */
  between(from, to, f) {
    if (this.isEmpty)
      return;
    for (let i = 0; i < this.chunk.length; i++) {
      let start = this.chunkPos[i], chunk = this.chunk[i];
      if (to >= start && from <= start + chunk.length && chunk.between(start, from - start, to - start, f) === false)
        return;
    }
    this.nextLayer.between(from, to, f);
  }
  /**
  Iterate over the ranges in this set, in order, including all
  ranges that end at or after `from`.
  */
  iter(from = 0) {
    return HeapCursor.from([this]).goto(from);
  }
  /**
  @internal
  */
  get isEmpty() {
    return this.nextLayer == this;
  }
  /**
  Iterate over the ranges in a collection of sets, in order,
  starting from `from`.
  */
  static iter(sets, from = 0) {
    return HeapCursor.from(sets).goto(from);
  }
  /**
  Iterate over two groups of sets, calling methods on `comparator`
  to notify it of possible differences.
  */
  static compare(oldSets, newSets, textDiff, comparator, minPointSize = -1) {
    let a = oldSets.filter((set) => set.maxPoint > 0 || !set.isEmpty && set.maxPoint >= minPointSize);
    let b = newSets.filter((set) => set.maxPoint > 0 || !set.isEmpty && set.maxPoint >= minPointSize);
    let sharedChunks = findSharedChunks(a, b, textDiff);
    let sideA = new SpanCursor(a, sharedChunks, minPointSize);
    let sideB = new SpanCursor(b, sharedChunks, minPointSize);
    textDiff.iterGaps((fromA, fromB, length) => compare(sideA, fromA, sideB, fromB, length, comparator));
    if (textDiff.empty && textDiff.length == 0)
      compare(sideA, 0, sideB, 0, 0, comparator);
  }
  /**
  Compare the contents of two groups of range sets, returning true
  if they are equivalent in the given range.
  */
  static eq(oldSets, newSets, from = 0, to) {
    if (to == null)
      to = 1e9 - 1;
    let a = oldSets.filter((set) => !set.isEmpty && newSets.indexOf(set) < 0);
    let b = newSets.filter((set) => !set.isEmpty && oldSets.indexOf(set) < 0);
    if (a.length != b.length)
      return false;
    if (!a.length)
      return true;
    let sharedChunks = findSharedChunks(a, b);
    let sideA = new SpanCursor(a, sharedChunks, 0).goto(from), sideB = new SpanCursor(b, sharedChunks, 0).goto(from);
    for (; ; ) {
      if (sideA.to != sideB.to || !sameValues(sideA.active, sideB.active) || sideA.point && (!sideB.point || !sideA.point.eq(sideB.point)))
        return false;
      if (sideA.to > to)
        return true;
      sideA.next();
      sideB.next();
    }
  }
  /**
  Iterate over a group of range sets at the same time, notifying
  the iterator about the ranges covering every given piece of
  content. Returns the open count (see
  [`SpanIterator.span`](https://codemirror.net/6/docs/ref/#state.SpanIterator.span)) at the end
  of the iteration.
  */
  static spans(sets, from, to, iterator, minPointSize = -1) {
    let cursor = new SpanCursor(sets, null, minPointSize).goto(from), pos = from;
    let openRanges = cursor.openStart;
    for (; ; ) {
      let curTo = Math.min(cursor.to, to);
      if (cursor.point) {
        let active = cursor.activeForPoint(cursor.to);
        let openCount = cursor.pointFrom < from ? active.length + 1 : cursor.point.startSide < 0 ? active.length : Math.min(active.length, openRanges);
        iterator.point(pos, curTo, cursor.point, active, openCount, cursor.pointRank);
        openRanges = Math.min(cursor.openEnd(curTo), active.length);
      } else if (curTo > pos) {
        iterator.span(pos, curTo, cursor.active, openRanges);
        openRanges = cursor.openEnd(curTo);
      }
      if (cursor.to > to)
        return openRanges + (cursor.point && cursor.to > to ? 1 : 0);
      pos = cursor.to;
      cursor.next();
    }
  }
  /**
  Create a range set for the given range or array of ranges. By
  default, this expects the ranges to be _sorted_ (by start
  position and, if two start at the same position,
  `value.startSide`). You can pass `true` as second argument to
  cause the method to sort them.
  */
  static of(ranges, sort = false) {
    let build = new RangeSetBuilder();
    for (let range of ranges instanceof Range ? [ranges] : sort ? lazySort(ranges) : ranges)
      build.add(range.from, range.to, range.value);
    return build.finish();
  }
  /**
  Join an array of range sets into a single set.
  */
  static join(sets) {
    if (!sets.length)
      return _RangeSet.empty;
    let result = sets[sets.length - 1];
    for (let i = sets.length - 2; i >= 0; i--) {
      for (let layer = sets[i]; layer != _RangeSet.empty; layer = layer.nextLayer)
        result = new _RangeSet(layer.chunkPos, layer.chunk, result, Math.max(layer.maxPoint, result.maxPoint));
    }
    return result;
  }
};
RangeSet.empty = /* @__PURE__ */ new RangeSet([], [], null, -1);
function lazySort(ranges) {
  if (ranges.length > 1)
    for (let prev = ranges[0], i = 1; i < ranges.length; i++) {
      let cur = ranges[i];
      if (cmpRange(prev, cur) > 0)
        return ranges.slice().sort(cmpRange);
      prev = cur;
    }
  return ranges;
}
RangeSet.empty.nextLayer = RangeSet.empty;
var RangeSetBuilder = class _RangeSetBuilder {
  finishChunk(newArrays) {
    this.chunks.push(new Chunk(this.from, this.to, this.value, this.maxPoint));
    this.chunkPos.push(this.chunkStart);
    this.chunkStart = -1;
    this.setMaxPoint = Math.max(this.setMaxPoint, this.maxPoint);
    this.maxPoint = -1;
    if (newArrays) {
      this.from = [];
      this.to = [];
      this.value = [];
    }
  }
  /**
  Create an empty builder.
  */
  constructor() {
    this.chunks = [];
    this.chunkPos = [];
    this.chunkStart = -1;
    this.last = null;
    this.lastFrom = -1e9;
    this.lastTo = -1e9;
    this.from = [];
    this.to = [];
    this.value = [];
    this.maxPoint = -1;
    this.setMaxPoint = -1;
    this.nextLayer = null;
  }
  /**
  Add a range. Ranges should be added in sorted (by `from` and
  `value.startSide`) order.
  */
  add(from, to, value) {
    if (!this.addInner(from, to, value))
      (this.nextLayer || (this.nextLayer = new _RangeSetBuilder())).add(from, to, value);
  }
  /**
  @internal
  */
  addInner(from, to, value) {
    let diff = from - this.lastTo || value.startSide - this.last.endSide;
    if (diff <= 0 && (from - this.lastFrom || value.startSide - this.last.startSide) < 0)
      throw new Error("Ranges must be added sorted by `from` position and `startSide`");
    if (diff < 0)
      return false;
    if (this.from.length == 250)
      this.finishChunk(true);
    if (this.chunkStart < 0)
      this.chunkStart = from;
    this.from.push(from - this.chunkStart);
    this.to.push(to - this.chunkStart);
    this.last = value;
    this.lastFrom = from;
    this.lastTo = to;
    this.value.push(value);
    if (value.point)
      this.maxPoint = Math.max(this.maxPoint, to - from);
    return true;
  }
  /**
  @internal
  */
  addChunk(from, chunk) {
    if ((from - this.lastTo || chunk.value[0].startSide - this.last.endSide) < 0)
      return false;
    if (this.from.length)
      this.finishChunk(true);
    this.setMaxPoint = Math.max(this.setMaxPoint, chunk.maxPoint);
    this.chunks.push(chunk);
    this.chunkPos.push(from);
    let last = chunk.value.length - 1;
    this.last = chunk.value[last];
    this.lastFrom = chunk.from[last] + from;
    this.lastTo = chunk.to[last] + from;
    return true;
  }
  /**
  Finish the range set. Returns the new set. The builder can't be
  used anymore after this has been called.
  */
  finish() {
    return this.finishInner(RangeSet.empty);
  }
  /**
  @internal
  */
  finishInner(next) {
    if (this.from.length)
      this.finishChunk(false);
    if (this.chunks.length == 0)
      return next;
    let result = RangeSet.create(this.chunkPos, this.chunks, this.nextLayer ? this.nextLayer.finishInner(next) : next, this.setMaxPoint);
    this.from = null;
    return result;
  }
};
function findSharedChunks(a, b, textDiff) {
  let inA = /* @__PURE__ */ new Map();
  for (let set of a)
    for (let i = 0; i < set.chunk.length; i++)
      if (set.chunk[i].maxPoint <= 0)
        inA.set(set.chunk[i], set.chunkPos[i]);
  let shared = /* @__PURE__ */ new Set();
  for (let set of b)
    for (let i = 0; i < set.chunk.length; i++) {
      let known = inA.get(set.chunk[i]);
      if (known != null && (textDiff ? textDiff.mapPos(known) : known) == set.chunkPos[i] && !(textDiff === null || textDiff === void 0 ? void 0 : textDiff.touchesRange(known, known + set.chunk[i].length)))
        shared.add(set.chunk[i]);
    }
  return shared;
}
var LayerCursor = class {
  constructor(layer, skip, minPoint, rank = 0) {
    this.layer = layer;
    this.skip = skip;
    this.minPoint = minPoint;
    this.rank = rank;
  }
  get startSide() {
    return this.value ? this.value.startSide : 0;
  }
  get endSide() {
    return this.value ? this.value.endSide : 0;
  }
  goto(pos, side = -1e9) {
    this.chunkIndex = this.rangeIndex = 0;
    this.gotoInner(pos, side, false);
    return this;
  }
  gotoInner(pos, side, forward) {
    while (this.chunkIndex < this.layer.chunk.length) {
      let next = this.layer.chunk[this.chunkIndex];
      if (!(this.skip && this.skip.has(next) || this.layer.chunkEnd(this.chunkIndex) < pos || next.maxPoint < this.minPoint))
        break;
      this.chunkIndex++;
      forward = false;
    }
    if (this.chunkIndex < this.layer.chunk.length) {
      let rangeIndex = this.layer.chunk[this.chunkIndex].findIndex(pos - this.layer.chunkPos[this.chunkIndex], side, true);
      if (!forward || this.rangeIndex < rangeIndex)
        this.setRangeIndex(rangeIndex);
    }
    this.next();
  }
  forward(pos, side) {
    if ((this.to - pos || this.endSide - side) < 0)
      this.gotoInner(pos, side, true);
  }
  next() {
    for (; ; ) {
      if (this.chunkIndex == this.layer.chunk.length) {
        this.from = this.to = 1e9;
        this.value = null;
        break;
      } else {
        let chunkPos = this.layer.chunkPos[this.chunkIndex], chunk = this.layer.chunk[this.chunkIndex];
        let from = chunkPos + chunk.from[this.rangeIndex];
        this.from = from;
        this.to = chunkPos + chunk.to[this.rangeIndex];
        this.value = chunk.value[this.rangeIndex];
        this.setRangeIndex(this.rangeIndex + 1);
        if (this.minPoint < 0 || this.value.point && this.to - this.from >= this.minPoint)
          break;
      }
    }
  }
  setRangeIndex(index) {
    if (index == this.layer.chunk[this.chunkIndex].value.length) {
      this.chunkIndex++;
      if (this.skip) {
        while (this.chunkIndex < this.layer.chunk.length && this.skip.has(this.layer.chunk[this.chunkIndex]))
          this.chunkIndex++;
      }
      this.rangeIndex = 0;
    } else {
      this.rangeIndex = index;
    }
  }
  nextChunk() {
    this.chunkIndex++;
    this.rangeIndex = 0;
    this.next();
  }
  compare(other) {
    return this.from - other.from || this.startSide - other.startSide || this.rank - other.rank || this.to - other.to || this.endSide - other.endSide;
  }
};
var HeapCursor = class _HeapCursor {
  constructor(heap) {
    this.heap = heap;
  }
  static from(sets, skip = null, minPoint = -1) {
    let heap = [];
    for (let i = 0; i < sets.length; i++) {
      for (let cur = sets[i]; !cur.isEmpty; cur = cur.nextLayer) {
        if (cur.maxPoint >= minPoint)
          heap.push(new LayerCursor(cur, skip, minPoint, i));
      }
    }
    return heap.length == 1 ? heap[0] : new _HeapCursor(heap);
  }
  get startSide() {
    return this.value ? this.value.startSide : 0;
  }
  goto(pos, side = -1e9) {
    for (let cur of this.heap)
      cur.goto(pos, side);
    for (let i = this.heap.length >> 1; i >= 0; i--)
      heapBubble(this.heap, i);
    this.next();
    return this;
  }
  forward(pos, side) {
    for (let cur of this.heap)
      cur.forward(pos, side);
    for (let i = this.heap.length >> 1; i >= 0; i--)
      heapBubble(this.heap, i);
    if ((this.to - pos || this.value.endSide - side) < 0)
      this.next();
  }
  next() {
    if (this.heap.length == 0) {
      this.from = this.to = 1e9;
      this.value = null;
      this.rank = -1;
    } else {
      let top = this.heap[0];
      this.from = top.from;
      this.to = top.to;
      this.value = top.value;
      this.rank = top.rank;
      if (top.value)
        top.next();
      heapBubble(this.heap, 0);
    }
  }
};
function heapBubble(heap, index) {
  for (let cur = heap[index]; ; ) {
    let childIndex = (index << 1) + 1;
    if (childIndex >= heap.length)
      break;
    let child = heap[childIndex];
    if (childIndex + 1 < heap.length && child.compare(heap[childIndex + 1]) >= 0) {
      child = heap[childIndex + 1];
      childIndex++;
    }
    if (cur.compare(child) < 0)
      break;
    heap[childIndex] = cur;
    heap[index] = child;
    index = childIndex;
  }
}
var SpanCursor = class {
  constructor(sets, skip, minPoint) {
    this.minPoint = minPoint;
    this.active = [];
    this.activeTo = [];
    this.activeRank = [];
    this.minActive = -1;
    this.point = null;
    this.pointFrom = 0;
    this.pointRank = 0;
    this.to = -1e9;
    this.endSide = 0;
    this.openStart = -1;
    this.cursor = HeapCursor.from(sets, skip, minPoint);
  }
  goto(pos, side = -1e9) {
    this.cursor.goto(pos, side);
    this.active.length = this.activeTo.length = this.activeRank.length = 0;
    this.minActive = -1;
    this.to = pos;
    this.endSide = side;
    this.openStart = -1;
    this.next();
    return this;
  }
  forward(pos, side) {
    while (this.minActive > -1 && (this.activeTo[this.minActive] - pos || this.active[this.minActive].endSide - side) < 0)
      this.removeActive(this.minActive);
    this.cursor.forward(pos, side);
  }
  removeActive(index) {
    remove(this.active, index);
    remove(this.activeTo, index);
    remove(this.activeRank, index);
    this.minActive = findMinIndex(this.active, this.activeTo);
  }
  addActive(trackOpen) {
    let i = 0, { value, to, rank } = this.cursor;
    while (i < this.activeRank.length && (rank - this.activeRank[i] || to - this.activeTo[i]) > 0)
      i++;
    insert(this.active, i, value);
    insert(this.activeTo, i, to);
    insert(this.activeRank, i, rank);
    if (trackOpen)
      insert(trackOpen, i, this.cursor.from);
    this.minActive = findMinIndex(this.active, this.activeTo);
  }
  // After calling this, if `this.point` != null, the next range is a
  // point. Otherwise, it's a regular range, covered by `this.active`.
  next() {
    let from = this.to, wasPoint = this.point;
    this.point = null;
    let trackOpen = this.openStart < 0 ? [] : null;
    for (; ; ) {
      let a = this.minActive;
      if (a > -1 && (this.activeTo[a] - this.cursor.from || this.active[a].endSide - this.cursor.startSide) < 0) {
        if (this.activeTo[a] > from) {
          this.to = this.activeTo[a];
          this.endSide = this.active[a].endSide;
          break;
        }
        this.removeActive(a);
        if (trackOpen)
          remove(trackOpen, a);
      } else if (!this.cursor.value) {
        this.to = this.endSide = 1e9;
        break;
      } else if (this.cursor.from > from) {
        this.to = this.cursor.from;
        this.endSide = this.cursor.startSide;
        break;
      } else {
        let nextVal = this.cursor.value;
        if (!nextVal.point) {
          this.addActive(trackOpen);
          this.cursor.next();
        } else if (wasPoint && this.cursor.to == this.to && this.cursor.from < this.cursor.to) {
          this.cursor.next();
        } else {
          this.point = nextVal;
          this.pointFrom = this.cursor.from;
          this.pointRank = this.cursor.rank;
          this.to = this.cursor.to;
          this.endSide = nextVal.endSide;
          this.cursor.next();
          this.forward(this.to, this.endSide);
          break;
        }
      }
    }
    if (trackOpen) {
      this.openStart = 0;
      for (let i = trackOpen.length - 1; i >= 0 && trackOpen[i] < from; i--)
        this.openStart++;
    }
  }
  activeForPoint(to) {
    if (!this.active.length)
      return this.active;
    let active = [];
    for (let i = this.active.length - 1; i >= 0; i--) {
      if (this.activeRank[i] < this.pointRank)
        break;
      if (this.activeTo[i] > to || this.activeTo[i] == to && this.active[i].endSide >= this.point.endSide)
        active.push(this.active[i]);
    }
    return active.reverse();
  }
  openEnd(to) {
    let open = 0;
    for (let i = this.activeTo.length - 1; i >= 0 && this.activeTo[i] > to; i--)
      open++;
    return open;
  }
};
function compare(a, startA, b, startB, length, comparator) {
  a.goto(startA);
  b.goto(startB);
  let endB = startB + length;
  let pos = startB, dPos = startB - startA;
  for (; ; ) {
    let dEnd = a.to + dPos - b.to, diff = dEnd || a.endSide - b.endSide;
    let end = diff < 0 ? a.to + dPos : b.to, clipEnd = Math.min(end, endB);
    if (a.point || b.point) {
      if (!(a.point && b.point && (a.point == b.point || a.point.eq(b.point)) && sameValues(a.activeForPoint(a.to), b.activeForPoint(b.to))))
        comparator.comparePoint(pos, clipEnd, a.point, b.point);
    } else {
      if (clipEnd > pos && !sameValues(a.active, b.active))
        comparator.compareRange(pos, clipEnd, a.active, b.active);
    }
    if (end > endB)
      break;
    if ((dEnd || a.openEnd != b.openEnd) && comparator.boundChange)
      comparator.boundChange(end);
    pos = end;
    if (diff <= 0)
      a.next();
    if (diff >= 0)
      b.next();
  }
}
function sameValues(a, b) {
  if (a.length != b.length)
    return false;
  for (let i = 0; i < a.length; i++)
    if (a[i] != b[i] && !a[i].eq(b[i]))
      return false;
  return true;
}
function remove(array, index) {
  for (let i = index, e = array.length - 1; i < e; i++)
    array[i] = array[i + 1];
  array.pop();
}
function insert(array, index, value) {
  for (let i = array.length - 1; i >= index; i--)
    array[i + 1] = array[i];
  array[index] = value;
}
function findMinIndex(value, array) {
  let found = -1, foundPos = 1e9;
  for (let i = 0; i < array.length; i++)
    if ((array[i] - foundPos || value[i].endSide - value[found].endSide) < 0) {
      found = i;
      foundPos = array[i];
    }
  return found;
}

// tests/support/obsidianStub.ts
var seams = globalThis;
var Platform = {
  isMobile: false,
  isDesktop: true,
  isMacOS: seams.__CS_MACOS__ === true
};
function normalizePath(p) {
  return p;
}
function requestUrl(options) {
  const serve = seams.__CS_REQUEST_URL__;
  if (!serve) return Promise.reject(new Error("no network in tests"));
  return serve(options.url);
}
var Notice = class {
  hide() {
  }
  constructor(message) {
    if (Array.isArray(seams.__CS_NOTICES__) && message !== void 0) {
      seams.__CS_NOTICES__.push(message);
    }
  }
};
var editorLivePreviewField = StateField.define({
  create: () => seams.__CS_LIVE_PREVIEW__ !== false,
  update: (value) => value
});

// src/i18n/localeManifest.ts
var LOCALE_FORMAT = 1;
var LOCALE_MANIFEST = {
  "ar": {
    bytes: 66208,
    sha256: "69767b9fc4110e92e56294873cd441501b8e1af616427055a708d7cac5a2708b",
    keys: 744
  },
  "bg": {
    bytes: 77698,
    sha256: "9e793a3bff14b635a297859c4c98c716dc44b67ea794ef985c95bba6436e7f50",
    keys: 744
  },
  "cs": {
    bytes: 54735,
    sha256: "737b10b4b3e68dddb85df81cbd6aef9c65ef92b731c71b5a76ad68b23b47b0c0",
    keys: 744
  },
  "da": {
    bytes: 52561,
    sha256: "3fc8f8d1af1c4220f084f1909d46b864318adf1ea66684e94ffeaf8fbfa82da0",
    keys: 744
  },
  "de": {
    bytes: 57453,
    sha256: "b58e5b4a580bcacf400d276ec5181eae2162977f9eb401724c89b05aaa43b312",
    keys: 744
  },
  "el": {
    bytes: 81479,
    sha256: "1d1cdde753d11a0fe538d351a6db319b85701b5ca33ccb525d5092bfab1a4beb",
    keys: 744
  },
  "es": {
    bytes: 55994,
    sha256: "e382ecd1d785a4c2cf4da7db72b4b3ba753783fcce63949c3af11ce381b248b4",
    keys: 744
  },
  "fa": {
    bytes: 71895,
    sha256: "b208399defdfa9cfc6d064ff485eeba65f0915d33d478b688c28535a98391e71",
    keys: 744
  },
  "fi": {
    bytes: 54594,
    sha256: "f50b74e03a168797a3dd94cb55651c0d4d40706f58dc381ee4eb85c0dedd782a",
    keys: 744
  },
  "fr": {
    bytes: 58094,
    sha256: "fd0cf4bc55c5b4dca9efc4676d828d370bcbfbe22466171936d8cd06f87f579d",
    keys: 744
  },
  "he": {
    bytes: 67051,
    sha256: "ca7654ec6b2d4228bda2ccbbbd5ed49413404310d56b50d9d937487f8e53f95f",
    keys: 744
  },
  "hi": {
    bytes: 89629,
    sha256: "607f2ceb711db2676f58a1b0d6464006ac3f9bfee61b40ed7c8b2acfd435532f",
    keys: 744
  },
  "hu": {
    bytes: 57909,
    sha256: "2c551c2994f70b6cb748df9f39c56cdbf633bfcf1cf6817ed047cf89ec56bb78",
    keys: 744
  },
  "id": {
    bytes: 53245,
    sha256: "18923dc0451e59ef077d97f8bd494423a3f7eaadfdf4240f6a552ac475091d79",
    keys: 744
  },
  "it": {
    bytes: 55656,
    sha256: "7db9ae3865818b4d3f74ceef50b98d6763fc87a69d43136bdf4ae331b8aec0e9",
    keys: 744
  },
  "ja": {
    bytes: 64266,
    sha256: "afa8faa0957868ece62ac2531121b04f30afc06e463da6247aa3ed67cf7a1023",
    keys: 744
  },
  "ko": {
    bytes: 59197,
    sha256: "6823e9eb8e1680710d050875feb700e5d95af2da095b054e0152f361d4697cc2",
    keys: 744
  },
  "ms": {
    bytes: 53127,
    sha256: "743c095342a09c7e09374694179933f7d7c7df4327b1f4823cb88ee88a88dc97",
    keys: 744
  },
  "nb": {
    bytes: 52697,
    sha256: "387328a07f1efe093b17da0eb2ac106d0af253635b7b2b826c1addea4ae566b5",
    keys: 744
  },
  "nl": {
    bytes: 55026,
    sha256: "4ce268a011512808027b9aea9f7295832f5a06f4c54f5eaeb8a5a5d10be21468",
    keys: 744
  },
  "pl": {
    bytes: 54999,
    sha256: "e7f9184e3f141a77494774842e63f8bd150f13f785d5568f89a78587c21c5300",
    keys: 744
  },
  "pt": {
    bytes: 55899,
    sha256: "102fb2e04cb707fcfe28968762d8d01600349c04f23ac3cc32c0a75dafa29d22",
    keys: 744
  },
  "ro": {
    bytes: 56401,
    sha256: "8e88972b65925b16228f0d8922794e8a26c30312826c4ac491d52006748ca6a5",
    keys: 744
  },
  "ru": {
    bytes: 76421,
    sha256: "b43972ea87f480c01e0f09209c2189a6703f27b13e6a828cacb5a563d4641314",
    keys: 744
  },
  "sv": {
    bytes: 53572,
    sha256: "9a09e5afa870c8e96d9b0d97971cb08111fa3c3d978c2abafc642b1b1ee346c7",
    keys: 744
  },
  "th": {
    bytes: 88616,
    sha256: "3297fff39ad55a13830921ec76610595539b1681c2b4926744136e47dd0f4d97",
    keys: 744
  },
  "tr": {
    bytes: 54989,
    sha256: "fae9f705eeeeaedcca8ed176fe52adcb904f86f717bb2f0978835bb845f11a71",
    keys: 744
  },
  "uk": {
    bytes: 74856,
    sha256: "2429900412b65689ac7fbd859256e66164db0301aec8454aaede6f3a1e5765ab",
    keys: 744
  },
  "vi": {
    bytes: 60668,
    sha256: "7f2c952608551b6c3c1a523ebe3c07903607575d00f89070fdeca3fc51141dee",
    keys: 744
  },
  "zh": {
    bytes: 50421,
    sha256: "e4fcd8a0be0045f402f627ba84b05b06913a8f80ffbe0a47810862b2c6eb8de2",
    keys: 744
  },
  "zhTW": {
    bytes: 50561,
    sha256: "6688b1f02ca0ea5234a4f651c929611667987bcd2579e0db927dead82dc486bc",
    keys: 744
  }
};

// src/i18n/en.ts
var en = {
  // Commands
  "cmd.openSettings": "Open settings",
  "cmd.createCallout": "Create new callout type",
  "cmd.insertEmptyCallout": "Insert empty callout",
  "cmd.calloutWrap": "Wrap in callout",
  "cmd.calloutUnwrap": "Unwrap from callout",
  "cmd.openQuickInsert": "Quick insert block callout",
  // Commands — names generated for the user's own commands. Obsidian adds
  // the "Callout Studio: " prefix itself, so these must not repeat it.
  "cmd.customWrapBlock": "Wrap in {{name}} block callout",
  "cmd.customInsertBlock": "Insert {{name}} block callout",
  "cmd.customInsertHeading": "Insert H{{level}} {{name}} heading callout",
  "cmd.customInsertInline": "Insert {{name}} inline callout",
  // Autocomplete
  "autocomplete.createNew": 'Create new callout: "{{name}}"',
  // Vault scan / fallback / delete
  "settings.fallbackTag": "Default",
  "settings.fallbackTagAuto": "Default fallback",
  "settings.rescanVault": "Discover callouts",
  "settings.rescanVaultDesc": "Scan saved notes and the current theme once. Add missing callout types to your saved settings without changing existing types. Nothing is discovered automatically.",
  "settings.rescanVaultHintAction": "Discover now",
  "manualDiscovery.failed": "Discovery was not saved. Check that settings are writable and sync has finished, then try Settings \u2192 My callout types \u2192 Discover now again. Existing callouts have not been replaced.",
  "saveStatus.missing": "Saving is paused because the settings file is missing. This can happen after reinstalling or while sync is still running. Finish synchronization and retry. To intentionally replace the missing file, use Create a new settings file in Callout Studio settings.",
  "saveStatus.unreadable": "Saving is paused because the settings file cannot be read safely. Finish synchronization or restore a valid copy, then retry. The existing file has been kept.",
  "saveStatus.recoveryRead": "Saving is paused because the local recovery copy cannot be read. Your settings file may still be intact. Check available storage, then retry recovery. Existing recovery data will not be overwritten.",
  "saveStatus.recoveryWrite": "The local recovery copy could not be saved. Check available storage, then retry. Keep your draft open until saving succeeds.",
  "saveStatus.writePermission": "The settings file could not be saved because storage denied write access. Check that the vault and plugin folder are writable, then retry.",
  "saveStatus.writeSpace": "The settings file could not be saved because storage is full or its quota was exceeded. Free some space, then retry.",
  "saveStatus.notesFailed": "The callout definition was saved, but some note updates could not be completed. Keep this editor open and choose Save to retry the unfinished updates.",
  "saveStatus.write": "The settings file could not be saved. Check available storage, folder permissions and synchronization, then retry before closing Obsidian.",
  "saveStatus.changed": "The settings file changed while you were editing. Your draft is still available. Choose Retry saving and recovery to load the incoming settings, then review your draft and save again.",
  "saveStatus.syncConflict": "Incoming settings conflict with a callout needed for unfinished note updates. Your draft and pending updates have been kept. Resolve the conflicting settings before retrying.",
  "saveStatus.retry": "Retry saving and recovery",
  "saveStatus.retrying": "Checking saving and recovery\u2026",
  "saveStatus.retryFailed": "Saving is still blocked. Check the saving status in Callout Studio settings for the cause, then retry.",
  "saveStatus.reviewDraft": "Incoming settings and recovery checks are complete. Your draft is unchanged. Review it and save again.",
  "saveStatus.settingsArrived": "Existing settings arrived and were loaded. A replacement file was not created.",
  "saveStatus.newFile": "Create a new settings file",
  "notice.settingsBackupFailed": "Settings recovery could not continue because a safety backup could not be saved. Check available storage and write permissions, then retry.",
  "notice.settingsBackupSaved": "A recovery copy of local callout definitions was saved before applying incoming settings: {{path}}.",
  "commandBuilder.missingCallout": "Paused: the callout is missing. Discover or create it to restore this command, or edit the command to choose another type.",
  "manualDiscovery.scanning": "Discovering\u2026",
  "settings.rescanComplete": "Re-scan complete: {{count}} new callout(s) added.",
  "settings.readOnly": "Callout Studio could not use its settings file when Obsidian started, so nothing on this page is being saved on this device. Your changes will last until you close Obsidian. Reload Obsidian once the file is back \u2014 if you sync this vault, let the sync finish first.",
  "replaceModal.deleteWithoutReplaceSuffix": "(falls back to default)",
  "replaceModal.titleDelete": "Delete callout",
  "replaceModal.titleReplace": "Replace in vault",
  // Welcome / splash screen (shown once on first load; reopen via header icon)
  "welcome.tooltip": "About Callout Studio",
  "welcome.title": "Welcome to Callout Studio!",
  "welcome.tagline": "Your complete solution for creating, styling and managing Obsidian callouts.",
  "welcome.previewTitle": "See it in action",
  "welcome.demoName": "Callout Studio",
  // `{{id}}` is the demo callout the splash styles itself with, so the three
  // examples cannot be hijacked by a theme that restyles `tip` or `warning`
  // (see settings/welcomeDemo.ts). Two structural rules for anyone
  // translating this: `{` must follow `]` with NO space or the payload is
  // read as literal prose, and the sample must END outside a block callout
  // (see EmbeddableMarkdownEditor.parkCursor).
  "welcome.sample": "Callout Studio lets you create callouts with a custom icon, colors, and name.\n\nYou can use this callout in **three** different ways:\n\n## [!{{id}}] Heading Callout\nTo turn any heading into a callout-style heading, add `[!type]` right after the `#`s.\n\nWant an [!{{id}}]{Inline Callout}? Just add `[!type]{text}` right in a sentence, without breaking your flow.\n\n> [!{{id}}] Block Callout\n> The classic callout works with the exact syntax you're already used to: `> [!type]`.\n\nThere's a lot more Callout Studio has to offer! [Learn more]({{repoUrl}}).\n",
  // Delete-callout modal (trash button on user rows)
  "deleteModal.title": 'Delete callout "{{name}}"?',
  "deleteModal.bodyInUse": "This callout appears {{count}} time(s) across {{files}} file(s).",
  "deleteModal.bodyInUseExplain": "Deleting will convert those blocks to plain text \u2014 they will no longer be styled and will lose the callout header.",
  "deleteModal.replaceHint": "You can replace it with another callout instead, which keeps your vault content as a styled callout.",
  "deleteModal.bodyUnused": '"{{name}}" is not used in any note, but it is a custom callout you customized. Deleting will remove it from this list.',
  "deleteModal.replaceInstead": "Replace instead",
  "deleteModal.deleteInUse": "Delete (convert to plain text)",
  "deleteModal.deleteUnused": "Delete callout",
  // The variant for a callout whose definition Callout Studio cannot remove:
  // one of Obsidian's built-ins, or a type the active theme declares.
  "deleteModal.titleKeep": 'Clear every use of "{{name}}"?',
  "deleteModal.keepsRowBuiltIn": "This is one of Obsidian's built-in callouts, so the type itself stays available \u2014 only its uses in your notes change.",
  "deleteModal.keepsRowTheme": "{{theme}} defines this callout type, so it stays available and keeps its look. Callout Studio only changes notes inside your vault \u2014 nothing belonging to your theme is touched.",
  "deleteModal.clearUsages": "Clear uses (convert to plain text)",
  // Settings — Section headings
  "settings.title": "Callout Studio",
  "settings.myCalloutTypes": "My callout types",
  "settings.builtInCallouts": "Built-in callouts",
  "settings.contextMenu": "Context menu",
  "settings.autocomplete": "Autocomplete",
  "settings.keyboardShortcuts": "Keyboard shortcuts",
  "settings.language": "Language",
  "settings.languageDesc": "Display language for Callout Studio. Defaults to Obsidian's interface language.",
  "settings.languageAuto": "Automatic (match Obsidian)",
  // Downloadable translations. English is built in; every other language is
  // fetched the first time it is needed and kept for later.
  "locale.downloading": "Downloading translation\u2026",
  "locale.notDownloaded": "{{name}} is not downloaded yet",
  "locale.notDownloadedDesc": "Callout Studio is showing English until the translation can be downloaded. It will try again the next time Obsidian starts.",
  "locale.retry": "Retry",
  "locale.diskWriteFailed": "Callout Studio could not save the translation to disk, so it will need downloading again next time.",
  "settings.importExport": "Import / export",
  "settings.import": "Import",
  "settings.export": "Export",
  "settings.importDesc": "Import your Callout Studio progress from another vault, or bring your callouts over from a different plugin.",
  "settings.exportDesc": "Save your callouts as a Callout Studio backup, or as a CSS snippet you can use elsewhere.",
  "settings.importConflictNotice": "Imported {{count}} callout type(s); {{overwritten}} existing entry/entries were overwritten.",
  // Settings — Toolbar
  "settings.addNewCallout": "Add new callout",
  // Settings — Empty states
  "settings.noCalloutsNow": "No custom callouts for now.",
  // Settings — Row actions
  "settings.editAria": "Edit {{name}}",
  "settings.moreRowActionsAria": "More actions for {{name}}",
  "settings.usageInfo": "{{count}} use(s) in {{files}} file(s)",
  "settings.replaceAction": "Replace in vault",
  "settings.deleteAction": "Delete",
  "settings.resetAction": "Reset to default",
  "settings.makeFallbackAction": "Use default fallback style",
  "settings.colorSwatchAria": "Accent: {{accent}} \xB7 Background: {{bg}}",
  // Handing a callout to the user's own CSS. Not a statement about the theme —
  // that is derived and has no action — so the wording names the snippet.
  "settings.externalCssAction": "Style with my own CSS",
  "settings.externalCssStopAction": "Let Callout Studio style this again",
  // The one label on any row: a callout sitting among the user's own that
  // Callout Studio has nonetheless stopped painting.
  "settings.externalCssTag": "External CSS",
  // Settings — callouts the active theme styles
  "settings.themeCalloutsHeading": "Callouts from your theme",
  "settings.themeCalloutsDesc": "{{theme}} supplies or restyles these, so Callout Studio leaves them exactly as your theme draws them and offers them as Block callouts only. Both kinds appear here: callout types your theme adds, and built-in callouts whose look it replaces. Callout types your theme adds are listed only while it is active.",
  "settings.themeCalloutsDefaultTheme": "Your theme",
  "settings.themePreviewAria": 'Preview "{{name}}" \u2014 see how your theme draws it',
  "settings.clearUsesAction": "Clear uses in your notes",
  "settings.builtInAllThemeStyled": "{{theme}} restyles every built-in callout, so they are all listed above and Callout Studio leaves them alone. To design one of your own, add a callout with a different ID.",
  // Settings — Fallback callout
  "settings.fallbackCallout": "Default fallback callout",
  "settings.fallbackCalloutDesc": "Unrecognized callout types in your vault will inherit the style of this callout.",
  // Settings — Global style
  "settings.globalStyle": "Global callout style",
  "settings.border": "Borders",
  "settings.borderAll": "All",
  "settings.borderTop": "Top",
  "settings.borderRight": "Right",
  "settings.borderBottom": "Bottom",
  "settings.borderLeft": "Left",
  "settings.borderWidth": "Border thickness",
  "settings.fontScaleGroup": "Font scale",
  "settings.titleScale": "Title",
  "settings.contentScale": "Content",
  "settings.inlineTextScale": "Text",
  "settings.shapeGroup": "Shape",
  "settings.borderRadius": "Corner rounding",
  "settings.alignGroup": "Align",
  "settings.alignContent": "Align content with title",
  "settings.headingSpacingGroup": "Title spacing",
  "settings.headingPadVertical": "Vertical spacing",
  "settings.headingGap": "Spacing between headers",
  "settings.headingFoldGroup": "Fold",
  "settings.headingFoldArrow": "Show fold arrow",
  "settings.styleDemoName": "Example",
  "settings.previewTitle": "Preview",
  // Settings — Saved color palettes
  "settings.customPalettes": "Saved color palettes",
  "settings.newPalette": "New palette",
  "settings.customPalettesEmpty": "No saved palettes yet.",
  "settings.editPaletteAria": "Edit palette {{name}}",
  "settings.deletePaletteAria": "Delete palette {{name}}",
  "settings.deletePaletteConfirm": 'Delete palette "{{name}}"?\nCallouts that use its colors are not affected.',
  // Settings — Autocomplete
  "settings.enableAutocomplete": "Enable [! Autocomplete",
  "settings.enableAutocompleteDesc": 'Show suggestions when you type "[!" inside a block callout in the editor. Pick a callout type from the list to insert a complete callout header.',
  // Settings — Keyboard shortcuts
  "settings.customCommands": "Commands and shortcuts",
  "settings.customCommandsDesc": "See every Callout Studio command and the shortcut it is bound to, and create your own commands for the callouts you use most. No shortcuts are assigned by default.",
  "settings.customCommandsButton": "Manage commands",
  // Command builder
  "commandBuilder.title": "Commands and shortcuts",
  "commandBuilder.desc": "Use the + button to set or change a shortcut in Obsidian's hotkey settings.",
  "commandBuilder.builtIn": "Built-in commands",
  "commandBuilder.toggleAria": "Turn {{name}} on or off",
  "commandBuilder.hotkeyBlank": "Blank",
  "commandBuilder.hotkeyAria": "Set a shortcut for {{name}}",
  "commandBuilder.yourCommands": "Your commands",
  "commandBuilder.newCommand": "New command",
  "commandBuilder.empty": "No custom commands yet.",
  "commandBuilder.unknownCommand": "this command",
  "commandBuilder.editAria": "Edit {{name}}",
  "commandBuilder.deleteAria": "Delete {{name}}",
  "commandBuilder.deleteConfirm": "Delete the command {{name}}? Any shortcut assigned to it will stop working.",
  "commandBuilder.newTitle": "New command",
  "commandBuilder.editTitle": "Edit command",
  "commandBuilder.format": "Callout format",
  "commandBuilder.formatDesc": "Which kind of callout the command writes.",
  "commandBuilder.formatHeading": "Heading",
  "commandBuilder.formatInline": "Inline",
  "commandBuilder.formatBlock": "Block",
  "commandBuilder.roleDisabled": "This format is turned off, so the command will insert plain text until you switch it back on.",
  "commandBuilder.roleThemeOwned": "Your theme supplies this callout, so it only has a Block format.",
  "commandBuilder.commandSuspended": "Paused: your theme supplies this callout, so it only has a Block format. This command works again when the theme stops supplying it.",
  "commandBuilder.callout": "Callout type",
  "commandBuilder.calloutDesc": "The callout this command inserts.",
  "commandBuilder.headingLevel": "Heading level",
  "commandBuilder.headingLevelDesc": "Which heading level to write.",
  "commandBuilder.action": "Action",
  "commandBuilder.actionDesc": "Wrap turns the selection into a callout; insert adds an empty one.",
  "commandBuilder.actionWrap": "Wrap selection",
  "commandBuilder.actionInsert": "Insert new",
  "commandBuilder.preview": "Command name",
  "commandBuilder.duplicate": "You already have a command that does exactly this.",
  "commandBuilder.noCallouts": "There are no callout types to build a command from yet.",
  "commandBuilder.save": "Save",
  // Quick insert window (the ribbon icon). Block callouts only — the wording
  // has to say so, because the same list could plausibly be read as offering
  // heading and inline callouts too.
  "quickInsert.title": "Quick insert block callout",
  "quickInsert.desc": "Pick a callout to insert at the cursor. Block callouts only.",
  "quickInsert.searchPlaceholder": "Search callouts",
  "quickInsert.sourceAria": "Filter by callout source",
  "quickInsert.sourceAll": "All",
  "quickInsert.sourceBuiltIn": "Built-in",
  "quickInsert.sourceUser": "My callouts",
  "quickInsert.editAria": "Edit {{name}}",
  "quickInsert.insertAria": "Insert {{name}} as a block callout",
  "quickInsert.noResults": "No callouts found",
  "quickInsert.noUserCallouts": "You haven't created any callouts yet.",
  "quickInsert.noEditorHint": "No note is open in editing mode, so nothing can be inserted.",
  "quickInsert.noEditor": "Open a note in editing mode to insert a callout.",
  "quickInsert.readingViewHint": "This note is open in Reading view, so nothing can be inserted.",
  "quickInsert.readingView": "Switch to Source mode or Live Preview to insert a callout.",
  "quickInsert.noCursorHint": "There is no cursor in this note, so there is nowhere to insert.",
  "quickInsert.noCursor": "Place the cursor in the note where you want to insert the callout, then try again.",
  // Settings — Reset
  "settings.vaultMaintenance": "Vault insights & maintenance",
  "settings.vaultStats": "Callout statistics",
  "settings.vaultStatsDesc": "Count every callout in your Markdown notes \u2014 block, heading and inline \u2014 and group them by type.",
  "settings.vaultStatsButton": "View statistics",
  "settings.vaultStatsScanning": "Scanning",
  "settings.resetAll": "Reset",
  "settings.resetAllDesc": "Delete all user callouts, reset built-in callouts, global styles (borders, font scale, shape), saved color palettes, the right-click menu customization, and downloaded Material SVGs.",
  "settings.resetAllButton": "Reset everything",
  "settings.resetAllConfirm": "This will delete all custom callouts, reset built-in callouts, global styles, saved color palettes, the right-click menu customization, and all cached Material SVGs. This action cannot be undone. Are you sure?",
  "notice.resetAllDone": "Everything has been reset to defaults.",
  // Notices
  "notice.customCommandsRemoved": "Removed {{count}} custom command(s) whose callout type no longer exists.",
  "notice.customCommandMissingCallout": "That command's callout type no longer exists.",
  "notice.exported": "Callouts exported to callout-studio-export.json",
  "notice.exportedCssCreated": "CSS snippet saved to {{path}}",
  "notice.exportedCssUpdated": "CSS snippet updated at {{path}}",
  "notice.exportedCssUnchanged": "The CSS snippet is already up to date.",
  "notice.exportCssEmpty": "There are no custom callouts to export.",
  "notice.exportCssFailed": "Could not save the CSS snippet. Check the developer console for details.",
  "notice.exportCssEnabled": "This snippet is switched on in this vault. Callout Studio already styles these callouts here, and the snippet keeps the styling it had when you exported.",
  "notice.importedJSON": "Imported {{count}} callout type(s) from JSON.",
  "notice.importedSettings": "Imported plugin settings.",
  "notice.importedCalloutManager": "Imported from Callout Manager: {{created}} created, {{updated}} updated.",
  "notice.importedAdmonition": "Imported from Admonition: {{created}} created, {{updated}} updated.",
  "notice.noNewJSON": "No new callout types were imported (ids may already exist).",
  "notice.iconDownloadFailed": 'Could not download Material icon "{{name}}". It may be unavailable for this style/weight, or your connection may be offline.',
  "notice.externalCssOn": `Callout Studio no longer styles "{{name}}" \u2014 your own CSS decides how it looks. Its Heading Callout and Inline Callout forms won't render.`,
  "notice.externalCssOff": 'Callout Studio now styles "{{name}}" again.',
  "notice.vaultRewritePartial": "{{count}} note(s) could not be updated and were left unchanged. See the developer console for details.",
  "notice.calloutDeleteIncomplete": "Some notes could not be converted. The callout type was kept. Completed conversions are saved; resolve the file problem, then run the action again to finish.",
  "notice.vaultScanFailed": "Callout usage could not be counted because {{count}} note(s) could not be read. Check storage and synchronization, then try again.",
  "notice.settingsUnreadable": "Callout Studio could not read its settings file, so your callout types are missing from this session. Nothing has been written and the file on disk is unchanged \u2014 reload Obsidian to try again.",
  "notice.settingsMissing": "Callout Studio's settings file is missing, so your callout types are missing from this session. Nothing has been written \u2014 if you sync this vault, let the sync finish and reload Obsidian before making any changes.",
  "notice.settingsMissingAction": "Create a new settings file",
  "notice.settingsNotSaved": "That change was not saved. Callout Studio could not use its settings file when Obsidian started, so nothing is being written on this device \u2014 your changes will last until you close Obsidian. See Settings \u2192 Callout Studio for what to do.",
  "notice.settingsNewerVersion": "Callout Studio's settings were saved by a newer version of the plugin, so nothing will be written on this device until you update it. Your settings are safe \u2014 update Callout Studio here and reload Obsidian.",
  "notice.settingsChangedElsewhere": "Callout Studio's settings were changed on another device, so this change was not saved. The other device's settings are being loaded now \u2014 please make the change again.",
  "notice.nothingToWrap": "Nothing to wrap.",
  "notice.cursorNotInsideCallout": "Cursor is not inside a callout.",
  "notice.autocompleteTargetMoved": "Nothing was inserted \u2014 the line changed while the editor was open.",
  "notice.openHotkeysFailed": "Could not open Obsidian hotkeys settings.",
  "notice.filterHotkeysFailed": "Opened Obsidian hotkeys, but could not apply the Callout Studio filter.",
  // Callout Editor
  "editor.editCallout": "Edit callout",
  "editor.newCallout": "New callout",
  "editor.displayName": "Display name",
  "editor.displayNameDesc": "The human-readable label shown in the UI",
  "editor.displayNameBuiltIn": "Display name cannot be changed for built-in callouts",
  "editor.displayNamePlaceholder": "My callout",
  "editor.calloutIds": "Callout IDs",
  "editor.calloutIdsDesc": "All identifiers for this callout. Spaces are allowed.\nPress Enter or the + button to add.",
  "editor.calloutIdsPlaceholder": "Add ID",
  "editor.addId": "Add ID",
  "editor.idLinkedToName": "Linked to the display name",
  "editor.idCannotDelete": "This ID is linked to the display name and can't be deleted \u2014 edit the name to change it",
  "editor.icon": "Icon",
  "editor.pickIcon": "Change icon",
  "editor.replaceIcon": "Replace icon",
  "editor.removeIcon": "Remove icon",
  "editor.noIcon": "No icon",
  "editor.resetIcon": "Reset icon to default",
  "editor.livePreview": "Live preview",
  "editor.iconAdjustment": "Icon adjustment",
  "editor.picture": "Picture",
  "editor.size": "Size",
  "editor.horizontalOffset": "Horizontal offset",
  "editor.verticalOffset": "Vertical offset",
  "editor.colors": "Color",
  "editor.colorsDesc": "Sets this callout's border, background, and text colors.",
  "editor.resetColors": "Reset colors to default",
  "editor.paletteDeleted": "Deleted color",
  "editor.paletteGroupObsidian": "Obsidian callouts",
  "editor.paletteGroupPresets": "Color presets",
  "editor.paletteGroupCustom": "Custom",
  "editor.paletteNewColor": "New color\u2026",
  "editor.contrastWarning": "Low contrast against the background \u2014 may be hard to read",
  "editor.foldable": "Foldable",
  "editor.foldableDesc": "Choose whether the callout can be folded and which default state to apply across the vault.",
  "editor.foldOff": "Off",
  "editor.foldOpen": "Open by default",
  "editor.foldClosed": "Closed by default",
  "editor.cancel": "Cancel",
  "editor.saveChanges": "Save changes",
  "editor.saving": "Saving\u2026",
  "editor.saveFailed": "The save could not be completed. If this editor is still open, keep it open and retry after checking storage and synchronization. Some settings or note updates may already have been saved.",
  "notice.settingsSaveFailed": "Callout Studio could not save your changes. Check available storage and synchronization, then retry before closing Obsidian.",
  "editor.createCallout": "Create callout",
  "editor.nameRequired": "A display name is required before creating a callout.",
  "editor.noChangesToSave": "No changes were made.",
  "editor.downloadingIcon": "Downloading icon",
  "editor.idEmpty": "At least one ID is required",
  "editor.idExists": "A callout with this ID already exists",
  "editor.idConflict": "This ID conflicts with an existing callout",
  "editor.idFromTheme": "{{theme}} already supplies a callout with this ID, so Callout Studio can't style it. Pick a different ID.",
  "editor.idThemePattern": "Heads up: your theme styles every callout matching {{pattern}}, so it may override how this one looks.",
  "editor.idDashConflict": 'Obsidian writes spaces as dashes, so this ID collides with "{{other}}"',
  "editor.untitledCallout": "Untitled Callout",
  "editor.loremIpsum": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  "editor.loremIpsumShort": "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "editor.sampleInlineText": "Here is an inline [!{id}] callout inside a paragraph.",
  "editor.previewReadOnly": "The live preview can't be edited",
  // Theme callout preview window — opens instead of the editor for a callout
  // the active theme supplies or restyles.
  "themePreview.title": "{{name}} \u2014 supplied by your theme",
  "themePreview.owned": '{{theme}} supplies and styles "{{name}}". Callout Studio will not override it, so its Block callout looks exactly as your theme draws it.',
  "themePreview.readOnly": "That means its colour, icon, name and ID can't be changed here. If you want a design of your own, create a new callout with a different ID.",
  "themePreview.blockOnly": "Heading and Inline formats are unavailable for callouts supplied by your theme. Block callouts use the theme's native style.",
  "themePreview.previewTitle": "How it renders now",
  "themePreview.blockSample": "> [!{{id}}] {{name}}\n> This is what the callout's content looks like.\n",
  "editor.externalStyleClose": "Got it",
  // Palette editor modal
  "palette.newTitle": "New color palette",
  "palette.editTitle": "Edit color palette",
  "palette.groupPalette": "Palette",
  "palette.name": "Name",
  "palette.namePlaceholder": "My palette",
  "palette.nameExists": "A palette with this name already exists",
  "palette.baseColor": "Base color",
  "palette.baseColorHint": "We'll automatically match the background color to it. If you'd like, you can control it separately by {{link}}.",
  "palette.baseColorHintLink": "clicking here",
  // Doubles as the title of the palette editor's "Colors" card, which holds
  // the simple Base color row as well as the advanced per-channel grid.
  "palette.advancedColors": "Colors",
  "palette.advancedColorsHint": "Editing colors for {{mode}} mode - the other mode updates automatically. Switch Obsidian's theme to check it.",
  "palette.revertHint": "Prefer a single base color instead? {{link}}.",
  "palette.revertHintLink": "Revert",
  "palette.lightMode": "Light",
  "palette.darkMode": "Dark",
  "palette.accentColor": "Accent color",
  "palette.backgroundColorChannel": "Background color",
  "palette.textColorChannel": "Text color",
  "palette.bgIntensity": "Intensity",
  "palette.bgStyle": "Style",
  "palette.bgSolid": "Solid",
  "palette.bgGradient": "Gradient",
  "palette.bgTransparent": "Transparent",
  "palette.gradientTo": "Second color",
  "palette.gradientDirection": "Direction",
  "palette.gradientText": "Gradient title text",
  "palette.save": "Save",
  // Color name suggestions (used to prefill palette names)
  "colorName.red": "Red",
  "colorName.orange": "Orange",
  "colorName.amber": "Amber",
  "colorName.yellow": "Yellow",
  "colorName.lime": "Lime",
  "colorName.green": "Green",
  "colorName.teal": "Teal",
  "colorName.cyan": "Cyan",
  "colorName.sky": "Sky",
  "colorName.blue": "Blue",
  "colorName.indigo": "Indigo",
  "colorName.violet": "Violet",
  "colorName.purple": "Purple",
  "colorName.pink": "Pink",
  "colorName.rose": "Rose",
  "colorName.brown": "Brown",
  "colorName.gray": "Gray",
  "colorName.black": "Black",
  "colorName.white": "White",
  "colorName.crimson": "Crimson",
  "colorName.coral": "Coral",
  "colorName.grape": "Grape",
  "colorName.plum": "Plum",
  "colorName.bubblegum": "Bubblegum",
  // Icon Picker
  "iconPicker.pickIcon": "Pick an icon",
  "iconPicker.confirm": "Confirm",
  "iconPicker.cancel": "Cancel",
  "iconPicker.lucide": "Lucide",
  "iconPicker.tabler": "Tabler Icons",
  "iconPicker.material": "Material",
  "iconPicker.emoji": "Emoji",
  "iconPicker.searchLucide": "Search Lucide icons",
  "iconPicker.searchTabler": "Search Tabler icons",
  "iconPicker.tablerStyle": "Icon style",
  "iconPicker.tablerStyleOutline": "Outline",
  "iconPicker.tablerStyleFilled": "Filled",
  "iconPicker.loadMore": "Load more",
  "iconPicker.materialStyle": "Icon style",
  "iconPicker.materialStyleOutlined": "Outlined",
  "iconPicker.materialStyleFilled": "Filled",
  "iconPicker.materialStyleRounded": "Rounded",
  "iconPicker.materialStyleSharp": "Sharp",
  "iconPicker.materialWeight": "Icon weight",
  "iconPicker.materialWeight100": "Thin",
  "iconPicker.materialWeight200": "Extra Light",
  "iconPicker.materialWeight300": "Light",
  "iconPicker.materialWeight400": "Regular",
  "iconPicker.materialWeight500": "Medium",
  "iconPicker.materialWeight600": "Semi Bold",
  "iconPicker.materialWeight700": "Bold",
  "iconPicker.materialFontFailed": "Couldn't load the Material icon previews. Icon names are shown instead \u2014 searching and picking still work.",
  "iconPicker.materialFontRetry": "Try again",
  "iconPicker.searchMaterial": "Search Material icons",
  "iconPicker.searchEmoji": "Search emojis",
  "iconPicker.skinTone": "Skin tone",
  "iconPicker.allCategories": "All categories",
  "iconPicker.noIconSelected": "No icon selected",
  "iconPicker.noResults": "No icons match your search.",
  "iconPicker.octicons": "Octicons",
  "iconPicker.searchOcticons": "Search Octicons",
  "iconPicker.fa": "Font Awesome",
  "iconPicker.searchFa": "Search Font Awesome",
  "iconPicker.faStyle": "Icon style",
  "iconPicker.faStyleSolid": "Solid",
  "iconPicker.faStyleRegular": "Regular",
  "iconPicker.faStyleBrands": "Brands",
  "iconPicker.rpgAwesome": "RPG Awesome",
  "iconPicker.searchRpgAwesome": "Search RPG Awesome",
  "iconPicker.image": "Your images",
  "iconPicker.searchImage": "Search your images",
  "iconPicker.imageTooLarge": "{{name}} is too large. Pictures must be under 5 MB.",
  "iconPicker.imageUnsupported": "{{name}} is not a supported picture. Use SVG, PNG, JPEG or WebP.",
  "iconPicker.imageInvalidSvg": "{{name}} could not be read as a safe SVG, so it was not added.",
  "iconPicker.imageDecodeFailed": "{{name}} could not be read as a picture.",
  "iconPicker.imageDuplicate": "{{name}} is already in your images. Rename the file, or delete the picture you already have.",
  "iconPicker.imageAdd": "Add images",
  "iconPicker.imageEmpty": "No pictures yet. Add an SVG, PNG, JPEG or WebP file from your computer, or drop one here.",
  "iconPicker.imageDelete": "Delete",
  "iconPicker.imageDeleteConfirm": "Delete \u201C{{name}}\u201D?",
  "iconPicker.imageDeleteInUse": "{{count}} callouts use this picture. They will fall back to a placeholder icon until you give them a new one.",
  "iconPicker.imageRecolor": "Follow callout color",
  "iconPicker.allSources": "All sources",
  "iconPicker.searchAllSources": "Search all icon sources",
  "iconPicker.sourcesNotDownloaded": "Not included yet: {{names}}. Pick a source above to download it.",
  "iconPicker.chooseSource": "Choose source",
  "iconPicker.sourceGroup": "{{name}} \xB7 {{count}}",
  // Source menu — what each library holds, in a few words
  "iconPicker.descAllSources": "search every library at once",
  "iconPicker.descLucide": "Obsidian's own set, always offline",
  "iconPicker.descTabler": "clean and consistent UI icons, outline and filled",
  "iconPicker.descMaterial": "Google's set, four styles and seven weights",
  "iconPicker.descEmoji": "colour glyphs, every skin tone",
  "iconPicker.descOcticons": "GitHub's interface icons",
  "iconPicker.descFa": "solid, regular and brand marks",
  "iconPicker.descRpgAwesome": "fantasy and tabletop icons",
  "iconPicker.descImage": "pictures you add from your computer",
  // Icon picker — category filter dropdown labels
  "iconPicker.cat.Accessibility": "Accessibility",
  "iconPicker.cat.Actions": "Actions",
  "iconPicker.cat.Activities": "Activities",
  "iconPicker.cat.Alert": "Alert",
  "iconPicker.cat.Alphabet": "Alphabet",
  "iconPicker.cat.Android": "Android",
  "iconPicker.cat.Animals": "Animals",
  "iconPicker.cat.Arrows": "Arrows",
  "iconPicker.cat.Astronomy": "Astronomy",
  "iconPicker.cat.Audio&Video": "Audio & Video",
  "iconPicker.cat.Automotive": "Automotive",
  "iconPicker.cat.Badges": "Badges",
  "iconPicker.cat.Brand": "Brand",
  "iconPicker.cat.Buildings": "Buildings",
  "iconPicker.cat.Business": "Business",
  "iconPicker.cat.Camping": "Camping",
  "iconPicker.cat.Charity": "Charity",
  "iconPicker.cat.Charts": "Charts",
  "iconPicker.cat.Charts + Diagrams": "Charts + Diagrams",
  "iconPicker.cat.Childhood": "Childhood",
  "iconPicker.cat.Clothing + Fashion": "Clothing + Fashion",
  "iconPicker.cat.Coding": "Coding",
  "iconPicker.cat.Communicate": "Communicate",
  "iconPicker.cat.Communication": "Communication",
  "iconPicker.cat.Computers": "Computers",
  "iconPicker.cat.Connectivity": "Connectivity",
  "iconPicker.cat.Construction": "Construction",
  "iconPicker.cat.Currencies": "Currencies",
  "iconPicker.cat.Database": "Database",
  "iconPicker.cat.Design": "Design",
  "iconPicker.cat.Development": "Development",
  "iconPicker.cat.Devices": "Devices",
  "iconPicker.cat.Devices + Hardware": "Devices + Hardware",
  "iconPicker.cat.Disaster + Crisis": "Disaster + Crisis",
  "iconPicker.cat.Document": "Document",
  "iconPicker.cat.E-commerce": "E-commerce",
  "iconPicker.cat.Editing": "Editing",
  "iconPicker.cat.Education": "Education",
  "iconPicker.cat.Electrical": "Electrical",
  "iconPicker.cat.Emoji": "Emoji",
  "iconPicker.cat.Energy": "Energy",
  "iconPicker.cat.Extensions": "Extensions",
  "iconPicker.cat.Files": "Files",
  "iconPicker.cat.Film + Video": "Film + Video",
  "iconPicker.cat.Food": "Food",
  "iconPicker.cat.Food + Beverage": "Food + Beverage",
  "iconPicker.cat.Fruits + Vegetables": "Fruits + Vegetables",
  "iconPicker.cat.Games": "Games",
  "iconPicker.cat.Gaming": "Gaming",
  "iconPicker.cat.Gender": "Gender",
  "iconPicker.cat.Genders": "Genders",
  "iconPicker.cat.Gestures": "Gestures",
  "iconPicker.cat.Halloween": "Halloween",
  "iconPicker.cat.Hands": "Hands",
  "iconPicker.cat.Hardware": "Hardware",
  "iconPicker.cat.Health": "Health",
  "iconPicker.cat.Holidays": "Holidays",
  "iconPicker.cat.Home": "Home",
  "iconPicker.cat.Household": "Household",
  "iconPicker.cat.Humanitarian": "Humanitarian",
  "iconPicker.cat.Images": "Images",
  "iconPicker.cat.Laundry": "Laundry",
  "iconPicker.cat.Letters": "Letters",
  "iconPicker.cat.Logic": "Logic",
  "iconPicker.cat.Logistics": "Logistics",
  "iconPicker.cat.Map": "Map",
  "iconPicker.cat.Maps": "Maps",
  "iconPicker.cat.Maritime": "Maritime",
  "iconPicker.cat.Marketing": "Marketing",
  "iconPicker.cat.Math": "Math",
  "iconPicker.cat.Mathematics": "Mathematics",
  "iconPicker.cat.Media": "Media",
  "iconPicker.cat.Media Playback": "Media Playback",
  "iconPicker.cat.Medical + Health": "Medical + Health",
  "iconPicker.cat.Money": "Money",
  "iconPicker.cat.Mood": "Mood",
  "iconPicker.cat.Moving": "Moving",
  "iconPicker.cat.Music + Audio": "Music + Audio",
  "iconPicker.cat.Nature": "Nature",
  "iconPicker.cat.Numbers": "Numbers",
  "iconPicker.cat.Photography": "Photography",
  "iconPicker.cat.Photos + Images": "Photos + Images",
  "iconPicker.cat.Political": "Political",
  "iconPicker.cat.Privacy": "Privacy",
  "iconPicker.cat.Punctuation + Symbols": "Punctuation + Symbols",
  "iconPicker.cat.Religion": "Religion",
  "iconPicker.cat.Science": "Science",
  "iconPicker.cat.Science Fiction": "Science Fiction",
  "iconPicker.cat.Security": "Security",
  "iconPicker.cat.Shapes": "Shapes",
  "iconPicker.cat.Shopping": "Shopping",
  "iconPicker.cat.Social": "Social",
  "iconPicker.cat.Spinners": "Spinners",
  "iconPicker.cat.Sport": "Sport",
  "iconPicker.cat.Sports + Fitness": "Sports + Fitness",
  "iconPicker.cat.Symbols": "Symbols",
  "iconPicker.cat.System": "System",
  "iconPicker.cat.Text": "Text",
  "iconPicker.cat.Text Formatting": "Text Formatting",
  "iconPicker.cat.Time": "Time",
  "iconPicker.cat.Toggle": "Toggle",
  "iconPicker.cat.Transit": "Transit",
  "iconPicker.cat.Transportation": "Transportation",
  "iconPicker.cat.Travel": "Travel",
  "iconPicker.cat.Travel + Hotel": "Travel + Hotel",
  "iconPicker.cat.UI actions": "UI actions",
  "iconPicker.cat.Users + People": "Users + People",
  "iconPicker.cat.Vehicles": "Vehicles",
  "iconPicker.cat.Version control": "Version control",
  "iconPicker.cat.Weather": "Weather",
  "iconPicker.cat.Writing": "Writing",
  "iconPicker.cat.Zodiac": "Zodiac",
  // Downloadable icon packs
  "iconPack.downloadTitle": "{{name}} is not downloaded yet",
  "iconPack.downloadDetail": "{{count}} icons \xB7 {{size}} \xB7 one-time download",
  "iconPack.download": "Download",
  "iconPack.downloading": "Downloading {{name}}\u2026",
  "iconPack.downloadFailed": "Could not download {{name}}. Check your connection and try again.",
  "iconPack.retry": "Retry",
  "iconPack.faBrandsNotice": "Brand icons are trademarks of their respective owners. Their inclusion does not indicate endorsement. Please use them only to represent the company, product, or service they refer to.",
  "iconPack.artworkRestored": "Downloaded the icon artwork for {{names}}.",
  "iconPack.diskWriteFailed": "Callout Studio could not save the icon pack to disk, so it will need downloading again next time. The icons you pick are still saved with your settings.",
  // Icon licences & credits
  "credits.title": "Icon licences and credits",
  "credits.intro": "Callout Studio draws on several open icon libraries. Their licences are reproduced below, along with what was changed to use them here.",
  "credits.fullNotices": "Full third-party notices",
  "credits.pluginLicense": "Callout Studio's own code is under a permissive license; the icon libraries keep their own licences.",
  // Context Menu
  "contextMenu.editCallout": "Edit callout settings",
  "contextMenu.copyMarkdown": "Copy callout Markdown",
  "contextMenu.openSettings": "Open Callout Studio settings",
  "contextMenu.setFoldClosed": "Set callout closed (-)",
  "contextMenu.setFoldOpen": "Set callout open (+)",
  "contextMenu.setFoldNone": "Make callout non-collapsible",
  "contextMenu.cutSection": "Cut heading section",
  "contextMenu.copySection": "Copy heading section",
  "contextMenu.deleteSection": "Delete heading section",
  // Heading callouts
  "heading.toggleFold": "Toggle fold",
  // Global settings section (per-role style popups)
  "settings.globalSettings": "Global Callout Studio style options",
  "settings.globalSettingsScope": "These are global settings: each one changes the shape, spacing, and size of every callout Callout Studio styles at once. Callouts your theme styles keep the theme's own design.",
  "settings.globalSettingsRegularDesc": "Adjust the border, radius, font scale, and alignment of every block callout in your vault.",
  "settings.globalSettingsHeadingDesc": "Adjust the border, shape, and vertical spacing of every heading callout in your vault.",
  "settings.globalSettingsInlineDesc": "Adjust the border and shape of every inline callout in your vault.",
  "settings.globalSettingsCustomize": "Customize",
  // Callout types section
  "settings.calloutTypeRegular": "Block callout",
  "settings.calloutTypeHeading": "Heading callout",
  "settings.calloutTypeInline": "Inline callout",
  // Context menu customization
  "settings.customizeMenu": "Customize menu items",
  "settings.customizeMenuDesc": "Choose which right-click actions appear for each callout type and reorder them. Works in source mode and Live Preview.",
  "settings.customizeMenuButton": "Customize menu items",
  "menuCustomize.title": "Customize right-click menu",
  "menuCustomize.desc": "Toggle actions on or off and drag the handle to reorder them. Changes are saved automatically.",
  "menuCustomize.regular": "Block callout",
  "menuCustomize.heading": "Heading callout",
  "menuCustomize.inline": "Inline callout",
  "menuCustomize.dragHandle": "Drag to reorder",
  "menuItem.edit": "Edit callout",
  "menuItem.openSettings": "Open settings",
  "menuItem.copyMarkdown": "Copy Markdown",
  "menuItem.foldDefaults": "Fold defaults (open / closed / none)",
  "menuItem.cutSection": "Cut section",
  "menuItem.copySection": "Copy section",
  "menuItem.deleteSection": "Delete section",
  // Confirm modal
  "confirm.ok": "Delete",
  "confirm.cancel": "Cancel",
  // Headings for each confirmation — every window carries one, so each
  // caller of ConfirmModal names what it is about to do.
  "confirm.titleDeleteCommand": "Delete command",
  "confirm.titleResetAll": "Reset all callouts",
  "confirm.titleResetCallout": "Reset callout",
  "confirm.titleDeletePalette": "Delete palette",
  "confirm.titleDeleteImage": "Delete image",
  "confirm.titleOverwriteSnippet": "Overwrite CSS snippet",
  "confirm.overwriteSnippet": "The CSS snippet in your snippets folder has changed since Callout Studio wrote it. Exporting again replaces the whole file.",
  "confirm.overwriteSnippetOk": "Overwrite",
  "confirm.titleStartFresh": "Create a new settings file",
  "confirm.startFresh": "This creates a new settings file from the callout types and settings currently shown. Any previous readable recovery copy is kept in a backup. If the missing file is still on its way from another device, or is still syncing, it will be replaced everywhere \u2014 including on the devices that still have your callouts.\nOnly do this if you deleted the file yourself, or if you are sure it is not coming back.",
  "confirm.startFreshOk": "Create a new settings file",
  // Vault edge-case modals
  "vault.filesUpdated": "Updated {{count}} callout reference(s) in vault files.",
  "vault.idsUpdated": "Updated {{count}} callout ID(s) in vault files: {{oldIds}} \u2192 {{newId}}",
  "vault.titlesUpdated": "Updated {{count}} callout title(s) in vault files: {{oldTitle}} \u2192 {{newTitle}}",
  "vault.replaceWith": "Replace with:",
  "vault.deleteWithout": "Delete without replacing",
  "vault.confirmDelete": "Confirm",
  "vault.confirmReplace": "Replace",
  "vault.replacePromptInUse": '"{{name}}" is used {{count}} time(s) in {{files}} file(s). Pick a callout to replace it with:',
  "vault.replacePromptUnused": 'Pick a callout to replace "{{name}}" with:',
  "vault.noReplacementAvailable": "No other callouts are available to replace this one.",
  "vault.convertedToPlainText": "Converted {{blocks}} callout block(s) in {{files}} file(s) to plain text.",
  "vault.resetAliasWarning": "{{count}} reference(s) in {{files}} file(s) use custom alias(es): {{aliases}}. These will stop working after reset. Continue?",
  "vault.resetConfirm": "Reset",
  "vault.resetAllInUse": "\u26A0 {{count}} callout reference(s) in {{files}} file(s) use custom callout types that will be deleted.",
  // Vault statistics modal
  "vaultStats.title": "Callout statistics",
  "vaultStats.totalCallouts": "Total callouts",
  "vaultStats.typesFound": "Types found",
  "vaultStats.filesWithCallouts": "Files with callouts",
  "vaultStats.filesScanned": "Markdown files scanned",
  "vaultStats.empty": "No callouts were found in Markdown notes.",
  "vaultStats.columnType": "Type",
  "vaultStats.columnFiles": "Files",
  "vaultStats.sourceAlias": "Alias of {{id}}",
  "vaultStats.sourceUnknown": "Not defined",
  // Retained unused. The report is three columns now — type, how it is written
  // (`byRole`) and files — so the Name, Source and Count headers are gone with
  // their columns, `unknown` went when an unresolved row started being named
  // after its own id, and of the six source labels only the two above survive,
  // as a tag beside the id. Deleting an English key while the 31 generated
  // locale files still carry it fails their "no key English lacks" check until
  // the next translation pass, and the strings cost nothing to keep.
  "vaultStats.unknown": "Unknown",
  "vaultStats.columnName": "Name",
  "vaultStats.columnSource": "Source",
  "vaultStats.columnCount": "Count",
  "vaultStats.sourceBuiltIn": "Built-in",
  "vaultStats.sourceCustom": "Custom",
  "vaultStats.sourceAutoFallback": "Auto fallback",
  "vaultStats.sourceTheme": "CSS snippet",
  "vaultStats.byRole": "Written as",
  "vaultStats.roleBlock": "Block",
  "vaultStats.roleHeading": "Heading",
  "vaultStats.roleInline": "Inline",
  "vaultStats.close": "Close",
  // Import validation
  "import.title": "Import issues",
  "import.reportLeadIn": "Hmm, looks like the file you imported has been modified. Here is the list of issues:",
  "import.reportLeadInFatal": "Hmm, this file does not look like a Callout Studio export. It cannot be imported:",
  "import.entryHeading": "Entry {{index}} \u2014 {{label}}",
  "import.summary": "{{valid}} of {{total}} entries are valid \xB7 {{issues}} issue(s) found.",
  "import.btnCancel": "Cancel",
  "import.btnImportValid": "Import valid only ({{count}})",
  "import.err.notRecognized": "Unrecognized file: expected a callout definitions array or a Callout Studio export.",
  "import.warn.settingsIgnored": "The settings block was not a valid object and was ignored.",
  "import.warn.invalidGradient": "The background gradient was invalid and was ignored.",
  "import.err.parseFailed": "The file is not valid JSON and could not be parsed.",
  "import.err.entryNotObject": "Entry must be an object.",
  "import.err.requiredMissing": 'Required field "{{field}}" is missing or has the wrong type.',
  "import.err.idEmpty": "ID must not be empty.",
  "import.err.idTooLong": 'ID "{{value}}" is {{length}} characters; the maximum is {{max}}.',
  "import.err.idBadChar": 'ID "{{value}}" contains invalid characters ("|", "[", "]", tabs, and line breaks are not allowed).',
  "import.err.idMetadata": 'ID "{{value}}" contains a "|". In Obsidian everything after the first "|" is callout metadata, not part of the type, so this entry describes the "{{id}}" callout. Skipped, so your existing "{{id}}" is left untouched.',
  "import.err.idReserved": `ID "{{value}}" is reserved by Callout Studio for its own previews and can't be imported.`,
  "import.err.displayNameEmpty": "Display name must not be empty.",
  "import.err.displayNameTooLong": "Display name is {{length}} characters; the maximum is {{max}}.",
  "import.err.boolField": '"{{field}}" must be a boolean (true or false).',
  "import.err.iconNotObject": "Icon must be an object.",
  "import.err.iconTypeInvalid": 'Icon type "{{value}}" is not one of: {{types}}.',
  "import.warn.iconFieldIgnored": '"{{field}}" only applies to Material icons and is ignored for icon type {{type}}.',
  "import.err.iconValueEmpty": "Icon value must be a non-empty string.",
  "import.err.iconValueTooLong": "Icon value is unusually long ({{length}} characters).",
  "import.err.materialStyle": 'Material icon style "{{value}}" is not one of: outlined, filled, rounded, sharp.',
  "import.err.materialWeight": 'Material icon weight "{{value}}" must be an integer between 100 and 700, in steps of 100.',
  "import.warn.iconRecolorIgnored": '"recolor" only applies to your own pictures and is ignored for icon type {{type}}.',
  "import.err.iconRecolorInvalid": '"recolor" must be true or false (got "{{value}}").',
  "import.err.colorInvalid": '"{{field}}" must be a hex color like "#448aff" (got "{{value}}").',
  "import.err.numberRange": '"{{field}}" must be a number between {{min}} and {{max}} (got "{{value}}").',
  "import.err.iconSizeRange": '"{{field}}" must be a number between {{min}} and {{max}} (got "{{value}}").',
  "import.err.iconAdjustShape": '"iconAdjust" must be an object mapping a callout type ("block", "heading", "inline") to its icon size and offsets.',
  "import.err.aliasesNotArray": '"aliases" must be an array of strings.',
  "import.err.aliasNotString": "Alias must be a string.",
  "import.err.aliasDup": 'Alias "{{value}}" is duplicated within this entry.',
  "import.err.tooManyIds": "Too many IDs ({{count}}); each callout can have at most {{max}} IDs (primary + aliases).",
  "import.err.metadataShape": '"metadata" must be an object whose values are all strings.',
  "import.warn.unknownFields": "Unknown field(s) ignored: {{fields}}.",
  "import.err.duplicateInFile": 'ID/alias "{{value}}" is already used by entry #{{first}} in this file.',
  "import.err.aliasConflict": 'Alias "{{value}}" is already used by another callout ("{{other}}") in your vault.',
  "import.warn.defaultFoldedAutofix": '"defaultFolded" was true while "foldable" was false; defaultFolded was reset to false.',
  "import.warn.imageMissing": "This callout uses a picture that is not in the file and not in this vault, so it will show a placeholder icon until you give it a new one.",
  "import.err.paletteIdInvalid": '"paletteId" must be a non-empty text ID (got "{{value}}").',
  "import.warn.iconNameUnknown": 'There is no "{{value}}" icon in {{type}}, so the default icon was used instead.',
  // Not necessarily a typo: Callout Manager lets you pick any icon Obsidian
  // knows about, which includes ones other plugins register — so the name can
  // be perfectly real and simply belong to a plugin this vault does not have.
  "import.warn.cmIconUnknownNew": 'The "{{value}}" icon is not available in this vault, so the default icon was used instead.',
  "import.warn.cmIconUnknownExisting": 'The "{{value}}" icon is not available in this vault, so "{{id}}" kept the icon it already had.',
  // Import — source chooser
  "import.chooseSource": "Import from",
  "import.sourceStudio": "Callout Studio",
  "import.sourceStudioDesc": "Load a .json file exported from Callout Studio.",
  "import.sourceCalloutManager": "Callout Manager",
  "import.sourceCalloutManagerDesc": "Bring your customized callouts over from the Callout Manager plugin.",
  "import.sourceAdmonition": "Admonition",
  "import.sourceAdmonitionDesc": "Bring your custom admonitions over from the Admonition plugin.",
  // Export — format chooser
  "export.chooseFormat": "Export as",
  "export.formatJson": "Callout Studio backup",
  "export.formatJsonDesc": "A .json file with your callouts and settings, for importing into another vault.",
  "export.formatCss": "CSS snippet",
  "export.formatCssDesc": "A .css file saved into this vault's snippets folder, for use where Callout Studio isn't installed. It covers regular callouts only, and is a snapshot \u2014 export again after you change a callout.",
  // Import — Callout Manager
  "import.cmTitle": "Import from Callout Manager",
  "import.cmInstructions": "Each customized callout comes over with its icon and color. Per-theme styling and custom CSS have no equivalent here and are left behind.",
  "import.cmFromVault": "This vault",
  "import.cmVaultChecking": "Looking for the Callout Manager plugin\u2026",
  "import.cmVaultFound": "{{count}} customized callout(s) found.",
  "import.cmVaultNotFound": "No customized callouts were found in this vault.",
  "import.cmPasteLabel": "Or paste Callout Manager's copied styles here:",
  "import.cmPlaceholder": "Paste the copied styles, or a data.json, here\u2026",
  "import.cmBtnCancel": "Cancel",
  "import.cmBtnImport": "Import",
  "import.err.cmNoBlocksFound": "No Callout Manager styles were found in the pasted text.",
  "import.err.cmNotRecognized": "Unrecognized file: expected the styles Callout Manager's Copy button produces, or a Callout Manager data.json.",
  "import.err.cmNoEntries": "No customized callouts were found to import.",
  "import.err.cmNoColorForNew": 'No usable color was found for the new callout "{{value}}"; it was skipped.',
  "import.err.cmIdConflict": 'ID "{{value}}" is already used as an alias by another callout ("{{other}}") and was skipped.',
  "import.warn.cmNoColorDefault": "No color was set in Callout Manager, so its default gray was used.",
  "import.warn.cmThemeCondition": "This callout's color or icon was set for one theme only. Callout Studio has no per-theme styling, so it was brought over for every theme.",
  "import.warn.cmCustomStyles": "This callout also has custom CSS in Callout Manager. That styling is not part of the import, so only its icon and color came over.",
  // Import — Admonition
  "import.admTitle": "Import from Admonition",
  "import.admInstructions": "Each admonition comes over as a callout with its name, icon, and color. Settings Callout Studio has no equivalent for (command, copy button, hidden title) are left behind.",
  "import.admFromVault": "This vault",
  "import.admVaultChecking": "Looking for the Admonition plugin\u2026",
  "import.admVaultFound": "{{count}} custom admonition(s) found.",
  "import.admVaultNotFound": "No custom admonitions were found in this vault.",
  "import.admFromFile": "A file",
  "import.admFromFileDesc": "An admonitions.json file, or a shared pack.",
  "import.admChooseFile": "Choose file\u2026",
  "import.admPasteLabel": "Or paste the JSON here:",
  "import.admPlaceholder": "Paste your admonitions here\u2026",
  "import.admBtnCancel": "Cancel",
  "import.admBtnImport": "Import",
  "import.err.admNotRecognized": "Unrecognized file: expected a list of admonitions, or an Admonition data.json.",
  "import.err.admNoEntries": "No admonitions were found to import.",
  "import.err.admTypeMissing": 'This admonition has no "type" and was skipped.',
  "import.warn.admIconUnknown": 'No icon named "{{value}}" was found in any icon library, so the default icon was used instead.',
  "import.warn.admIconUnknownExisting": 'No icon named "{{value}}" was found in any icon library, so "{{id}}" kept the icon it already had.',
  "import.warn.admImageFailed": "The uploaded picture could not be read, so the default icon was used instead.",
  "import.warn.admIconWithCss": "This admonition is styled by a CSS snippet in Admonition. That styling is not part of the import, so only its name, icon, and color came over.",
  "import.warn.admNoColor": "No color was set, so the default blue was used.",
  "import.warn.admTitleTruncated": "The title is {{length}} characters; it was shortened to {{max}}.",
  // Footer
  "footer.tagline": "Have feedback, comments, or suggestions? I'd love to hear from you!",
  "settings.deletePaletteConfirmLinkedOne": 'Delete palette "{{name}}"?\n1 callout uses it. It keeps its colors, and you can reconnect it later from the Color row in its editor.',
  "settings.deletePaletteConfirmLinked": 'Delete palette "{{name}}"?\n{{count}} callouts use it. They keep their colors, and you can reconnect them later from the Color row in any of their editors.',
  "settings.unlinkedColors": "Unlinked colors",
  "settings.unlinkedColorsDesc": "Callouts whose saved color was deleted. They keep the colors they had; restoring saves the color again and reconnects the whole group.",
  "settings.unlinkedColorOne": "1 callout",
  "settings.unlinkedColorCount": "{{count}} callouts",
  "settings.restoreColor": "Restore",
  "settings.palettesMergedNotice": "Merged {{count}} imported palette(s) into saved colors that already had the same colors.",
  "notice.palettesMerged": "Merged {{count}} saved color(s) that had identical colors: {{names}}. The callouts using them keep their colors and are now linked to the color that remains.",
  "editor.colorsDescDeleted": "This callout's saved color was deleted. You can save it again by {{link}}.",
  "editor.colorsDescDeletedOther": "This callout's saved color was deleted. You can save it again by {{link}} \u2014 1 other callout using it will be reconnected too.",
  "editor.colorsDescDeletedOthers": "This callout's saved color was deleted. You can save it again by {{link}} \u2014 {{count}} other callouts using it will be reconnected too.",
  "editor.colorsDescDeletedLink": "clicking here",
  "palette.colorExists": 'These colors are identical to "{{name}}". Two saved colors cannot be the same \u2014 change a color to tell them apart.',
  "palette.colorExistsUse": 'These colors are identical to "{{name}}". Two saved colors cannot be the same \u2014 change a color, or {{link}}.',
  "palette.colorExistsUseLink": "use the existing one",
  "footer.madeBy": "Made by Niv  \u2022  ",
  "notice.legacyDiscoveryArchived": "Upgrade recovery copy saved: {{path}}. It contains the previous discovery cache and startup CSS for recovery only; no callout types were restored automatically.",
  "notice.legacyDiscoveryArchiveFailed": "The upgrade recovery copy could not be completed. The previous local discovery cache and startup CSS have been kept unchanged. Check storage access and free space, then restart Obsidian to retry."
};

// src/i18n/index.ts
var LOCALE_FILES = {
  he: "he",
  zh: "zh",
  "zh-tw": "zhTW",
  "zh-hk": "zhTW",
  "zh-sg": "zh",
  es: "es",
  pt: "pt",
  fr: "fr",
  de: "de",
  ru: "ru",
  ja: "ja",
  ko: "ko",
  it: "it",
  tr: "tr",
  nl: "nl",
  pl: "pl",
  uk: "uk",
  id: "id",
  sv: "sv",
  ar: "ar",
  hi: "hi",
  cs: "cs",
  ro: "ro",
  vi: "vi",
  th: "th",
  fa: "fa",
  hu: "hu",
  da: "da",
  nb: "nb",
  no: "nb",
  el: "el",
  bg: "bg",
  ms: "ms",
  fi: "fi"
};
var locales = { en };
var currentLocale = "en";
function registerLocaleFile(file, strings) {
  for (const [code, id] of Object.entries(LOCALE_FILES)) {
    if (id === file) locales[code] = strings;
  }
}
function isLocaleRegistered(code) {
  return code in locales;
}
function obsidianLocale() {
  return (window.moment?.locale() ?? "en").toLowerCase();
}
function resolve(pref, has) {
  const lower = (pref === "auto" ? obsidianLocale() : pref).toLowerCase();
  if (has(lower)) return lower;
  const lang = lower.split("-")[0] ?? "en";
  return has(lang) ? lang : "en";
}
function resolveLocaleCode(pref) {
  return resolve(pref, (code) => code === "en" || code in LOCALE_FILES);
}
function resolveLocaleFile(pref) {
  return LOCALE_FILES[resolveLocaleCode(pref)] ?? null;
}
function setLocale(pref) {
  currentLocale = resolve(pref, (code) => code in locales);
}
function t(key, vars) {
  const table = locales[currentLocale] ?? en;
  let value = table[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      const literal = String(v);
      value = value.replace(
        new RegExp(`\\{\\{${k}\\}\\}`, "g"),
        () => literal
      );
    }
  }
  return value;
}
function getLocale() {
  return currentLocale;
}

// src/i18n/LocaleStore.ts
var DOWNLOAD_TIMEOUT_MS = 15e3;
var MAX_LOCALE_BYTES = 1048576;
var MAX_VALUE_LENGTH = 4096;
var REPO = "Niv20/obsidian-plugin-callout-studio";
function localeUrls(id, version) {
  return [
    `https://cdn.jsdelivr.net/gh/${REPO}@${version}/locales/${id}.json`,
    `https://raw.githubusercontent.com/${REPO}/${version}/locales/${id}.json`
  ];
}
function parseLocaleFile(raw, id) {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "not an object" };
  }
  const file = raw;
  if (file.format !== LOCALE_FORMAT) {
    return { ok: false, reason: `format ${String(file.format)}` };
  }
  if (file.locale !== id) {
    return { ok: false, reason: `locale "${String(file.locale)}"` };
  }
  if (typeof file.strings !== "object" || file.strings === null) {
    return { ok: false, reason: "strings is not an object" };
  }
  const entries = Object.entries(file.strings);
  if (entries.length === 0) return { ok: false, reason: "no strings" };
  for (const [key, value] of entries) {
    if (typeof value !== "string") {
      return { ok: false, reason: `"${key}" is not a string` };
    }
    if (value.length > MAX_VALUE_LENGTH) {
      return { ok: false, reason: `"${key}" is too long` };
    }
  }
  return { ok: true, file };
}
var LocaleStore = class {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest;
    this.states = /* @__PURE__ */ new Map();
    /** De-duplicates concurrent requests for the same file. */
    this.inFlight = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
    this.cancelDownloads = /* @__PURE__ */ new Set();
    this.destroyed = false;
    /** Set once a write has failed, so the user is only told the once. */
    this.diskWriteBroken = false;
  }
  /** Terminal: late adapter/network results cannot publish into a new session. */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.listeners.clear();
    this.states.clear();
    this.inFlight.clear();
    for (const cancel of this.cancelDownloads) cancel();
    this.cancelDownloads.clear();
  }
  onChange(cb) {
    if (this.destroyed) return () => {
    };
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  notify() {
    for (const cb of this.listeners) {
      if (this.destroyed) return;
      try {
        cb();
      } catch (e) {
        if (!this.destroyed) console.warn("[CalloutStudio] locale listener error", e);
      }
    }
  }
  state(id) {
    return this.states.get(id) ?? "absent";
  }
  /**
   * Is this preference renderable right now? English always is; anything else
   * needs its file loaded, whether fresh or stale.
   */
  isReady(pref) {
    if (this.destroyed) return false;
    const id = resolveLocaleFile(pref);
    if (!id) return true;
    const state = this.state(id);
    return state === "ready" || state === "stale";
  }
  // ── Disk ────────────────────────────────────────────────────────────
  /**
   * The plugin's own folder, so uninstalling takes the translations with it.
   * `manifest.dir` is typed optional, hence the reconstruction fallback — the
   * same shape `PackDataStore.packDir()` uses.
   *
   * Named `translations`, not `locales`: during development the repository
   * *is* the plugin folder, and `locales/` there holds the committed sources
   * this cache is built from. One name for both would have the runtime
   * overwrite the repo's own files, which is the same reason the icon packs
   * are served from `packs/` but cached into `icon-packs/`.
   */
  dir() {
    const base = this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
    return normalizePath(`${base}/translations`);
  }
  /**
   * Where a locale file lives once downloaded.
   *
   * Dropping a file here by hand also works — it is read on the next launch
   * and shape-checked like any other, so a machine that never reaches the
   * network can still be translated from a copy carried in by other means.
   */
  filePath(id) {
    return normalizePath(`${this.dir()}/${id}.json`);
  }
  /**
   * Load a locale from disk if it is there. Never fetches.
   *
   * The checksum decides `"fresh"` versus `"stale"` rather than accept versus
   * reject, because the two mean very different things for a translation: a
   * hash mismatch on an icon pack is damage, while here it is nearly always a
   * copy from a build before some strings were added. Refusing it would flip a
   * user's whole interface to English to avoid a handful of untranslated
   * labels — and would do it precisely when they are offline and cannot fix it.
   */
  async loadFromDisk(id) {
    if (this.destroyed) return "missing";
    const path = this.filePath(id);
    const expected = LOCALE_MANIFEST[id];
    try {
      const adapter = this.app.vault.adapter;
      if (!await adapter.exists(path) || this.destroyed) return "missing";
      const text = await adapter.read(path);
      if (this.destroyed) return "missing";
      if (text.length > MAX_LOCALE_BYTES) {
        console.warn(`[CalloutStudio] locale "${id}" on disk is too large`);
        return "invalid";
      }
      const fresh = await this.matches(text, expected);
      if (this.destroyed) return "missing";
      if (!this.accept(id, text, `disk (${path})`, fresh)) return "invalid";
      return fresh ? "fresh" : "stale";
    } catch (e) {
      if (this.destroyed) return "missing";
      console.warn(`[CalloutStudio] could not read locale "${id}"`, e);
      return "invalid";
    }
  }
  /**
   * Register whatever is already on disk for this preference, without touching
   * the network. Called before the first translated string of the session, so
   * the ordinary launch — where the file has been there for months — paints
   * straight into the user's language.
   */
  async prepare(pref) {
    if (this.destroyed) return null;
    const id = resolveLocaleFile(pref);
    if (!id) return null;
    const result = await this.loadFromDisk(id);
    if (this.destroyed) return null;
    this.notify();
    return result;
  }
  /**
   * Persist a locale so later launches skip the network. Best-effort by
   * design: a read-only vault or a suspended mobile app must not cost the user
   * the download they just did, so failure only downgrades this to
   * session-only.
   */
  async persist(id, text) {
    if (this.destroyed) return;
    const adapter = this.app.vault.adapter;
    const dir = this.dir();
    try {
      const exists = await adapter.exists(dir);
      if (this.destroyed) return;
      if (!exists) await adapter.mkdir(dir);
      if (this.destroyed) return;
      await adapter.write(this.filePath(id), text);
    } catch (e) {
      if (this.destroyed) return;
      console.warn(`[CalloutStudio] could not cache locale "${id}"`, e);
      if (!this.diskWriteBroken) {
        this.diskWriteBroken = true;
        new Notice(t("locale.diskWriteFailed"));
      }
    }
  }
  // ── Download ────────────────────────────────────────────────────────
  /**
   * Make a preference renderable: read the cache, and fetch only if what is
   * there is missing or older than this build. Resolves to whether the
   * language is now available.
   *
   * This is the single entry point for both callers — the background pass at
   * startup and the language picker — because the decision of whether a
   * download is needed belongs here, not in the UI.
   */
  async ensure(pref) {
    if (this.destroyed) return false;
    const id = resolveLocaleFile(pref);
    if (!id) return true;
    if (this.state(id) === "absent") await this.loadFromDisk(id);
    if (this.destroyed) return false;
    if (this.state(id) === "ready") return true;
    const hadStale = this.state(id) === "stale";
    const ok = await this.download(id);
    return !this.destroyed && (ok || hadStale);
  }
  /**
   * Fetch a locale, verify it, and make it usable. Concurrent calls share one
   * request.
   */
  download(id) {
    if (this.destroyed) return Promise.resolve(false);
    const existing = this.inFlight.get(id);
    if (existing) return existing;
    const run = this.runDownload(id).finally(() => {
      this.inFlight.delete(id);
    });
    if (!this.destroyed) this.inFlight.set(id, run);
    return run;
  }
  async runDownload(id) {
    if (this.destroyed) return false;
    const expected = LOCALE_MANIFEST[id];
    if (!expected) return false;
    const hadStale = this.state(id) === "stale";
    this.states.set(id, "loading");
    this.notify();
    let lastError;
    for (const url of localeUrls(id, this.manifest.version)) {
      if (this.destroyed) return false;
      try {
        const text = await this.fetchWithTimeout(url);
        if (this.destroyed) return false;
        const matches = await this.matches(text, expected);
        if (this.destroyed) return false;
        if (!matches) {
          console.warn(`[CalloutStudio] locale "${id}" mismatch from ${url}`);
          continue;
        }
        if (!this.accept(id, text, url, true)) continue;
        await this.persist(id, text);
        if (this.destroyed) return false;
        this.notify();
        return true;
      } catch (e) {
        if (this.destroyed) return false;
        lastError = e;
      }
    }
    this.states.set(id, hadStale ? "stale" : "failed");
    this.notify();
    console.warn(`[CalloutStudio] locale "${id}" download failed`, lastError);
    return false;
  }
  async fetchWithTimeout(url) {
    if (this.destroyed) throw new Error("Locale store destroyed");
    let timer = 0;
    let cancel = () => {
    };
    const timeout = new Promise((_, reject) => {
      cancel = () => {
        window.clearTimeout(timer);
        reject(new Error("Locale store destroyed"));
      };
      this.cancelDownloads.add(cancel);
      timer = window.setTimeout(
        () => reject(new Error(`timed out after ${DOWNLOAD_TIMEOUT_MS}ms`)),
        DOWNLOAD_TIMEOUT_MS
      );
    });
    try {
      const response = await Promise.race([requestUrl({ url }), timeout]);
      return response.text;
    } finally {
      window.clearTimeout(timer);
      this.cancelDownloads.delete(cancel);
    }
  }
  /** Is this text byte-for-byte the file this build expects? */
  async matches(text, expected) {
    if (this.destroyed || !expected) return false;
    const bytes = new TextEncoder().encode(text);
    if (bytes.byteLength !== expected.bytes) return false;
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    if (this.destroyed) return false;
    const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return hex === expected.sha256;
  }
  /** Parse, shape-check and publish locale text. */
  accept(id, text, source, fresh) {
    if (this.destroyed) return false;
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      console.warn(`[CalloutStudio] locale "${id}" from ${source} is not JSON`);
      return false;
    }
    const result = parseLocaleFile(raw, id);
    if (!result.ok) {
      console.warn(
        `[CalloutStudio] locale "${id}" from ${source} rejected: ${result.reason}`
      );
      return false;
    }
    registerLocaleFile(id, result.file.strings);
    this.states.set(id, fresh ? "ready" : "stale");
    return true;
  }
};

// tests/localeStore.test.ts
var globals = globalThis;
globals.window = globalThis;
var VERSION = "9.9.9";
var PLUGIN_DIR = ".obsidian/plugins/callout-studio";
var realFile = (id) => readFileSync(join(process.cwd(), "locales", `${id}.json`), "utf8");
function staleFile(id) {
  const parsed = JSON.parse(realFile(id));
  const [first] = Object.keys(parsed.strings);
  assert.ok(first, `${id}.json has no strings`);
  delete parsed.strings[first];
  const text = JSON.stringify(parsed);
  assert.notStrictEqual(text, realFile(id));
  return text;
}
function harness(manifestDir = PLUGIN_DIR) {
  globals.__CS_NOTICES__ = [];
  setLocale("en");
  const files = /* @__PURE__ */ new Map();
  const writes = [];
  const reads = [];
  const requests = [];
  const serve = /* @__PURE__ */ new Map();
  const dirs = /* @__PURE__ */ new Set();
  const unreadable = /* @__PURE__ */ new Set();
  const failWrites = { value: false };
  let notifications = 0;
  const adapter = {
    exists(path) {
      return Promise.resolve(files.has(path) || dirs.has(path));
    },
    read(path) {
      reads.push(path);
      if (unreadable.has(path)) return Promise.reject(new Error("EIO"));
      const text = files.get(path);
      return text === void 0 ? Promise.reject(new Error("ENOENT")) : Promise.resolve(text);
    },
    write(path, text) {
      if (failWrites.value) return Promise.reject(new Error("EROFS"));
      writes.push(path);
      files.set(path, text);
      return Promise.resolve();
    },
    mkdir(path) {
      if (failWrites.value) return Promise.reject(new Error("EROFS"));
      dirs.add(path);
      return Promise.resolve();
    }
  };
  const app = {
    vault: { adapter, configDir: ".obsidian" }
  };
  const manifest = {
    id: "callout-studio",
    dir: manifestDir,
    version: VERSION
  };
  const store = new LocaleStore(app, manifest);
  store.onChange(() => {
    notifications++;
  });
  globals.__CS_REQUEST_URL__ = (url) => {
    requests.push(url);
    const body = serve.get(url);
    return body === void 0 ? Promise.reject(new Error(`no route to ${url}`)) : Promise.resolve({ text: body });
  };
  return {
    store,
    files,
    writes,
    reads,
    requests,
    serve,
    failWrites,
    unreadable,
    notifications: () => notifications,
    path: (id) => store.filePath(id)
  };
}
function serveEverywhere(h, id, body) {
  for (const url of localeUrls(id, VERSION)) h.serve.set(url, body);
}
describe("a cached file this build expects costs nothing", () => {
  it("registers it and opens no connection", () => {
    const h = harness();
    h.files.set(h.path("he"), realFile("he"));
    return h.store.prepare("he").then((result) => {
      assert.strictEqual(result, "fresh");
      assert.deepStrictEqual(h.requests, []);
      assert.deepStrictEqual(h.writes, []);
      assert.strictEqual(h.store.state("he"), "ready");
      assert.ok(h.store.isReady("he"));
      assert.ok(isLocaleRegistered("he"));
    });
  });
  it("still opens none when ensure() is the one asking", async () => {
    const h = harness();
    h.files.set(h.path("de"), realFile("de"));
    assert.strictEqual(await h.store.ensure("de"), true);
    assert.deepStrictEqual(h.requests, []);
    assert.strictEqual(h.store.state("de"), "ready");
  });
  it("reads the file once, not once per caller", async () => {
    const h = harness();
    h.files.set(h.path("fr"), realFile("fr"));
    await h.store.prepare("fr");
    await h.store.ensure("fr");
    assert.deepStrictEqual(h.reads, [h.path("fr")]);
  });
  it("touches neither disk nor network for English", async () => {
    const h = harness();
    assert.strictEqual(await h.store.prepare("en"), null);
    assert.strictEqual(await h.store.ensure("en"), true);
    assert.ok(h.store.isReady("en"));
    assert.deepStrictEqual(h.reads, []);
    assert.deepStrictEqual(h.requests, []);
  });
  it("caches into the plugin's own folder, not the repo's locales/", async () => {
    const h = harness();
    assert.strictEqual(h.path("he"), `${PLUGIN_DIR}/translations/he.json`);
    assert.ok(!h.path("he").startsWith("locales/"));
    await h.store.prepare("he");
    assert.deepStrictEqual(h.reads, []);
  });
  it("reconstructs the folder when the manifest has no dir", async () => {
    const h = harness(void 0);
    assert.strictEqual(
      h.path("he"),
      ".obsidian/plugins/callout-studio/translations/he.json"
    );
    await h.store.prepare("he");
  });
});
describe("a cached file older than this build is used anyway", () => {
  it("registers it immediately and asks the network for nothing", async () => {
    const h = harness();
    h.files.set(h.path("he"), staleFile("he"));
    assert.strictEqual(await h.store.prepare("he"), "stale");
    assert.deepStrictEqual(h.requests, []);
    assert.strictEqual(h.store.state("he"), "stale");
    assert.ok(
      h.store.isReady("he"),
      "a stale translation is still readable"
    );
    assert.ok(isLocaleRegistered("he"));
  });
  it("renders from it, filling the missing keys from English", async () => {
    const h = harness();
    const parsed = JSON.parse(realFile("he"));
    const sample = parsed.strings["settings.language"];
    assert.ok(sample, "settings.language is untranslated in he.json");
    h.files.set(h.path("he"), staleFile("he"));
    await h.store.prepare("he");
    setLocale("he");
    assert.strictEqual(getLocale(), "he");
    assert.strictEqual(t("settings.language"), sample);
    assert.strictEqual(t("locale.retry"), parsed.strings["locale.retry"]);
    setLocale("en");
  });
  it("is refreshed when ensure() runs and the network answers", async () => {
    const h = harness();
    h.files.set(h.path("it"), staleFile("it"));
    serveEverywhere(h, "it", realFile("it"));
    await h.store.prepare("it");
    assert.strictEqual(await h.store.ensure("it"), true);
    assert.strictEqual(h.store.state("it"), "ready");
    assert.deepStrictEqual(h.writes, [h.path("it")]);
    assert.strictEqual(h.files.get(h.path("it")), realFile("it"));
  });
});
describe("a cached file that is not a locale file is refused", () => {
  it("rejects one claiming a different language", async () => {
    const h = harness();
    h.files.set(h.path("ja"), realFile("ko"));
    assert.strictEqual(await h.store.loadFromDisk("ja"), "invalid");
    assert.strictEqual(h.store.state("ja"), "absent");
    assert.ok(!isLocaleRegistered("ja"));
  });
  it("rejects one that is not JSON", async () => {
    const h = harness();
    h.files.set(
      h.path("ru"),
      "<!doctype html><title>captive portal</title>"
    );
    assert.strictEqual(await h.store.loadFromDisk("ru"), "invalid");
    assert.ok(!isLocaleRegistered("ru"));
  });
  it("rejects one whose strings are not strings", async () => {
    const h = harness();
    h.files.set(
      h.path("pl"),
      JSON.stringify({ format: 1, locale: "pl", strings: { a: 42 } })
    );
    assert.strictEqual(await h.store.loadFromDisk("pl"), "invalid");
    assert.ok(!isLocaleRegistered("pl"));
  });
  it("rejects an empty table", async () => {
    const h = harness();
    h.files.set(
      h.path("uk"),
      JSON.stringify({ format: 1, locale: "uk", strings: {} })
    );
    assert.strictEqual(await h.store.loadFromDisk("uk"), "invalid");
    assert.ok(!isLocaleRegistered("uk"));
  });
  it("rejects a format this build does not understand", async () => {
    const h = harness();
    h.files.set(
      h.path("sv"),
      JSON.stringify({ format: 99, locale: "sv", strings: { a: "b" } })
    );
    assert.strictEqual(await h.store.loadFromDisk("sv"), "invalid");
  });
  it("refuses a pathologically large file before parsing it", async () => {
    const h = harness();
    h.files.set(h.path("th"), "x".repeat(1048577));
    assert.strictEqual(await h.store.loadFromDisk("th"), "invalid");
    assert.ok(!isLocaleRegistered("th"));
  });
  it("survives a file it cannot read at all", async () => {
    const h = harness();
    h.files.set(h.path("hu"), realFile("hu"));
    h.unreadable.add(h.path("hu"));
    assert.strictEqual(await h.store.loadFromDisk("hu"), "invalid");
    assert.strictEqual(h.store.state("hu"), "absent");
    assert.ok(!isLocaleRegistered("hu"));
  });
  it("reports a language with no file at all as missing, not failed", async () => {
    const h = harness();
    assert.strictEqual(await h.store.prepare("nb"), "missing");
    assert.strictEqual(h.store.state("nb"), "absent");
    assert.ok(!h.store.isReady("nb"));
    assert.deepStrictEqual(h.requests, []);
  });
});
describe("a download is verified before it is believed", () => {
  it("pins the URL to this build's own version", () => {
    const [primary, fallback] = localeUrls("he", VERSION);
    assert.ok(primary?.includes(`@${VERSION}/locales/he.json`), primary);
    assert.ok(primary?.startsWith("https://cdn.jsdelivr.net/"), primary);
    assert.ok(fallback?.includes(`/${VERSION}/locales/he.json`), fallback);
    assert.ok(fallback?.startsWith("https://raw.githubusercontent.com/"));
  });
  it("accepts and caches bytes that match the manifest", async () => {
    const h = harness();
    serveEverywhere(h, "es", realFile("es"));
    assert.strictEqual(await h.store.ensure("es"), true);
    assert.strictEqual(h.store.state("es"), "ready");
    assert.ok(isLocaleRegistered("es"));
    assert.deepStrictEqual(h.writes, [h.path("es")]);
    assert.strictEqual(h.files.get(h.path("es")), realFile("es"));
    assert.strictEqual(
      Buffer.byteLength(h.files.get(h.path("es")) ?? "", "utf8"),
      LOCALE_MANIFEST.es.bytes
    );
  });
  it("tries jsDelivr first and falls through to raw.githubusercontent", async () => {
    const h = harness();
    const [primary, fallback] = localeUrls("pt", VERSION);
    assert.ok(primary && fallback);
    h.serve.set(primary, realFile("ro"));
    h.serve.set(fallback, realFile("pt"));
    assert.strictEqual(await h.store.ensure("pt"), true);
    assert.deepStrictEqual(h.requests, [primary, fallback]);
    assert.strictEqual(h.store.state("pt"), "ready");
    assert.deepStrictEqual(h.writes, [h.path("pt")]);
  });
  it("discards a truncated response", async () => {
    const h = harness();
    serveEverywhere(h, "cs", realFile("cs").slice(0, -20));
    assert.strictEqual(await h.store.ensure("cs"), false);
    assert.strictEqual(h.store.state("cs"), "failed");
    assert.deepStrictEqual(h.writes, []);
    assert.ok(!isLocaleRegistered("cs"));
  });
  it("discards a well-formed file for the wrong language", async () => {
    const h = harness();
    serveEverywhere(h, "da", realFile("fi"));
    assert.strictEqual(await h.store.ensure("da"), false);
    assert.strictEqual(h.store.state("da"), "failed");
    assert.deepStrictEqual(h.writes, []);
    assert.ok(!isLocaleRegistered("da"));
  });
  it("discards a captive portal's login page", async () => {
    const h = harness();
    serveEverywhere(
      h,
      "el",
      "<!doctype html><title>Sign in to Wi-Fi</title>"
    );
    assert.strictEqual(await h.store.ensure("el"), false);
    assert.strictEqual(h.store.state("el"), "failed");
    assert.deepStrictEqual(h.writes, []);
  });
  it("reports failure rather than throwing when every host is dead", async () => {
    const h = harness();
    assert.strictEqual(await h.store.ensure("bg"), false);
    assert.strictEqual(h.store.state("bg"), "failed");
    assert.strictEqual(h.requests.length, 2);
    assert.strictEqual(t("settings.language"), en["settings.language"]);
  });
});
describe("a failed refresh never damages the copy already on disk", () => {
  const survives = (h, id, before) => {
    assert.strictEqual(
      h.files.get(h.path(id)),
      before,
      "the file was altered"
    );
    assert.deepStrictEqual(h.writes, [], "a write was attempted");
    assert.strictEqual(h.store.state(id), "stale");
    assert.ok(h.store.isReady(id), "the language stopped being readable");
  };
  it("keeps it when the response is for another language", async () => {
    const h = harness();
    const before = staleFile("he");
    h.files.set(h.path("he"), before);
    serveEverywhere(h, "he", realFile("ar"));
    await h.store.prepare("he");
    assert.strictEqual(await h.store.ensure("he"), true);
    survives(h, "he", before);
  });
  it("keeps it when the response is truncated", async () => {
    const h = harness();
    const before = staleFile("nl");
    h.files.set(h.path("nl"), before);
    serveEverywhere(h, "nl", realFile("nl").slice(0, 100));
    await h.store.prepare("nl");
    assert.strictEqual(await h.store.ensure("nl"), true);
    survives(h, "nl", before);
  });
  it("keeps it when every host is unreachable", async () => {
    const h = harness();
    const before = staleFile("tr");
    h.files.set(h.path("tr"), before);
    await h.store.prepare("tr");
    assert.strictEqual(await h.store.ensure("tr"), true);
    assert.strictEqual(h.requests.length, 2, "both URLs should be tried");
    survives(h, "tr", before);
  });
  it("keeps it when the response is a plausible file with one byte changed", async () => {
    const h = harness();
    const before = staleFile("ko");
    const real = realFile("ko");
    const tampered = `${real.slice(0, -2)}}`.padEnd(real.length, " ");
    assert.strictEqual(tampered.length, real.length);
    h.files.set(h.path("ko"), before);
    serveEverywhere(h, "ko", tampered);
    await h.store.prepare("ko");
    assert.strictEqual(await h.store.ensure("ko"), true);
    survives(h, "ko", before);
  });
  it("replaces it only once a replacement has verified", async () => {
    const h = harness();
    h.files.set(h.path("vi"), staleFile("vi"));
    serveEverywhere(h, "vi", realFile("vi"));
    await h.store.prepare("vi");
    assert.strictEqual(await h.store.ensure("vi"), true);
    assert.deepStrictEqual(h.writes, [h.path("vi")]);
    assert.strictEqual(h.files.get(h.path("vi")), realFile("vi"));
    assert.strictEqual(h.store.state("vi"), "ready");
  });
});
describe("a vault that cannot be written to only loses the cache", () => {
  it("keeps the language for this session and says so once", async () => {
    const h = harness();
    h.failWrites.value = true;
    serveEverywhere(h, "hi", realFile("hi"));
    serveEverywhere(h, "ms", realFile("ms"));
    assert.strictEqual(await h.store.download("hi"), true);
    assert.strictEqual(h.store.state("hi"), "ready");
    assert.ok(isLocaleRegistered("hi"));
    assert.deepStrictEqual(h.writes, []);
    assert.deepStrictEqual(globals.__CS_NOTICES__, [
      en["locale.diskWriteFailed"]
    ]);
    assert.strictEqual(await h.store.download("ms"), true);
    assert.strictEqual(globals.__CS_NOTICES__?.length, 1);
  });
});
describe("concurrent callers share one request", () => {
  it("de-duplicates two downloads of the same file", async () => {
    const h = harness();
    serveEverywhere(h, "ro", realFile("ro"));
    const [a, b] = await Promise.all([
      h.store.download("ro"),
      h.store.download("ro")
    ]);
    assert.strictEqual(a, true);
    assert.strictEqual(b, true);
    assert.strictEqual(h.requests.length, 1);
  });
  it("lets a later caller start a new request once the first has settled", async () => {
    const h = harness();
    assert.strictEqual(await h.store.download("fi"), false);
    assert.strictEqual(h.store.state("fi"), "failed");
    serveEverywhere(h, "fi", realFile("fi"));
    assert.strictEqual(await h.store.download("fi"), true);
    assert.strictEqual(h.store.state("fi"), "ready");
  });
  it("notifies listeners so the UI can re-render when a file lands", async () => {
    const h = harness();
    serveEverywhere(h, "id", realFile("id"));
    const before = h.notifications();
    await h.store.ensure("id");
    assert.ok(h.notifications() > before, "no listener was told");
  });
  it("refuses a file id the manifest has never heard of", async () => {
    const h = harness();
    const unknown = "kl";
    assert.strictEqual(await h.store.download(unknown), false);
    assert.deepStrictEqual(h.requests, []);
  });
});
