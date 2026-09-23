# Third-party notices

Callout Studio's own code is released under a permissive [license](LICENSE)
that asks nothing of you. The icon libraries it draws on are separate works
with their own licences, and those are reproduced here in full.

Two of them are worth reading before you use them, rather than after:

- **Font Awesome Free**'s icons are CC BY 4.0. Redistributing something built
  with them — a theme, a vault template, a screenshot set — carries the same
  attribution requirement this file satisfies for the plugin.
- **Brand icons** (Font Awesome Brands, Tabler's Brand category, and GitHub's
  own marks in Octicons) are trademarks. No icon licence grants trademark
  rights, so their owners' usage guidelines apply regardless of what the icon
  licence permits.

## What the plugin ships, and what it fetches

The plugin bundle contains icon-library *search indexes* — names, keywords and
categories — and two Lucide-derived UI icons for quick insert and statistics.
Icon-pack artwork is not bundled.

Artwork is supplied as follows:

| Source | Artwork |
| --- | --- |
| Lucide | Shipped inside Obsidian; the plugin draws it via Obsidian's own API |
| Plugin UI icons | Two Lucide-derived SVG composites bundled with the plugin; no download |
| Emoji | Rendered by your system's emoji font; nothing is downloaded |
| Material Symbols | Fetched from Google, one icon at a time, only for icons you choose |
| Tabler Icons, Octicons, Font Awesome, RPG Awesome | Downloaded once when you press **Download** on that source in the icon picker — one file each, two for Tabler and three for Font Awesome (one per style) |

Downloaded packs are verified against a SHA-256 checksum built into the plugin
and cached in the plugin's own folder. See the README's *Network usage and
privacy* section for the exact URLs.

---

## Lucide

- **Homepage:** https://lucide.dev
- **Licence:** ISC
- **Included via:** Obsidian's built-in icon set, plus two bundled UI composites

The Lucide icon library is provided by Obsidian. Callout Studio also bundles
two derived UI icons: a paintbrush with a circle-plus badge for quick insert,
and a paintbrush with a search badge for callout occurrences and statistics.
The badges sit at the lower right. Lucide's paintbrush, circle-plus and search
shapes are tailored and recomposed for small UI sizes. Editable SVGs are in
[`docs/assets/ui-icons/`](docs/assets/ui-icons/).

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

Lucide derives in part from **Feather** icons:

```
MIT License

Copyright (c) 2013-2023 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Tabler Icons 3.46.0

- **Homepage:** https://tabler.io/icons
- **Licence:** MIT
- **Copyright:** Paweł Kuna

**Modifications:** Path data is extracted from the published SVGs and
re-serialized into a compressed pack file; the transparent bounding path every
upstream file opens with is dropped, the stroke styling of the outline set is
applied at render time rather than baked in, and the half-opacity on one path of
`brand-parsinta` is not carried over.

```
MIT License

Copyright (c) 2020-2026 Paweł Kuna

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Tabler's Brand category holds company marks, which are trademarks of their
owners. No icon licence grants trademark rights, so the same caution that
applies to Font Awesome Brands applies to those.

---

## Material Symbols

- **Homepage:** https://fonts.google.com/icons
- **Licence:** Apache License 2.0
- **Copyright:** Google LLC

**Modifications:** Icon names, categories and search keywords are extracted from
Google's published metadata and stored in a compressed index. Icon artwork is
not modified — each SVG is downloaded from Google as published, and only the
fill colour is applied at render time.

```
Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/LICENSE-2.0

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
these files except in compliance with the License. You may obtain a copy of the
License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
```

The full licence text is available at the URL above.

---

## Font Awesome Free 7.3.1

- **Homepage:** https://fontawesome.com
- **Licence page:** https://fontawesome.com/license/free
- **Copyright:** Fonticons, Inc.

Font Awesome Free is licensed in three parts:

| Component | Licence | Applies here? |
| --- | --- | --- |
| Icons | **CC BY 4.0** | Yes — this is what the plugin uses |
| Code | MIT | No code from Font Awesome is used |
| Fonts | SIL OFL 1.1 | No fonts are shipped or downloaded |

### Attribution

> Icons from **Font Awesome Free 7.3.1** by Fonticons, Inc. —
> https://fontawesome.com — licensed under
> [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**Modifications:** Path data was extracted from the official Font Awesome Free
SVGs and re-serialized into a compact form, which removes the attribution
comment those files carry. The fill colour is applied at render time rather than
baked in. No icon outline was altered.

This explicit attribution exists precisely because of that change: Font Awesome
considers its files self-attributing thanks to the embedded comment, and
stripping it moves the obligation onto this notice.

### Brand icons

Reproduced from Font Awesome's licence:

> All brand icons are trademarks of their respective owners. The use of these
> trademarks does not indicate endorsement of the trademark holder by Font
> Awesome, nor vice versa. **Please do not use brand logos for any purpose
> except to represent the company, product, or service to which they refer.**

The plugin shows this notice in the icon picker whenever the Brands source is
selected.

---

## Octicons 19.31.0

- **Homepage:** https://primer.style/octicons
- **Licence:** MIT
- **Copyright:** GitHub, Inc.

**Modifications:** Path data was extracted from the published SVGs and
re-serialized; `fill-rule` and `clip-rule` are preserved. The fill colour is
applied at render time. The plugin ships the 12px, 16px and 24px drawings and
chooses between them based on where the icon appears.

```
MIT License

Copyright (c) GitHub, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### GitHub's marks

Octicons includes GitHub's own logos (`mark-github`, `logo-github`, `logo-gist`,
the Copilot marks). These are GitHub trademarks; their use is governed by
GitHub's logo guidelines at https://github.com/logos, not by the MIT licence
above.

---

## RPG Awesome 0.2.0

- **Homepage:** https://nagoshiashumari.github.io/Rpg-Awesome/
- **Repository:** https://github.com/nagoshiashumari/Rpg-Awesome
- **Copyright:** Daniela Howe; contributions by Ivan Montiel

**Modifications:** RPG Awesome publishes only a webfont, so icon outlines were
extracted from its SVG font's glyph data and converted to standalone SVG paths.
This includes mirroring each outline from font coordinates (y-axis up, origin on
the baseline) into SVG coordinates, onto a 1024×1024 viewBox. The fill colour is
applied at render time. Two icons use the names from the project's stylesheet
rather than the font's internal glyph names, which disagree: `mountains` (the
font spells it `montains`) and `perspective-dice-two` (the font calls it
`perspective-dice-six-two`).

### A note on the licence

Upstream states its licence inconsistently, and we would rather record that than
paper over it:

| Source | Claim |
| --- | --- |
| `LICENSE.md` | BSD 2-Clause, © 2014 Daniela Howe |
| `README.md` | SIL OFL 1.1 (font), MIT (CSS/SASS), CC BY 3.0 (docs) |
| Font metadata | MIT |

All four are permissive and compatible with this plugin. Callout Studio complies
with the strictest reading — BSD 2-Clause, reproduced in full below — which
satisfies the requirements of the others as well. The README additionally states
that "attribution is appreciated but not required"; it is given anyway.

```
Copyright (c) 2014, Daniela Howe
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## Emoji data

- **Source:** [emojibase](https://github.com/milesj/emojibase)
- **Licence:** MIT
- **Copyright:** Miles Johnson

Only emoji *names and search keywords* come from emojibase. The glyphs
themselves are rendered by the reader's own system emoji font and are not part
of this plugin.

```
MIT License

Copyright (c) 2017-2024 Miles Johnson

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
