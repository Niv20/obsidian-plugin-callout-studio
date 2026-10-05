/** Decorative vector facets for the 566 × 232 center tile. */
export function heroCrystal() {
    // Two compact Obsidian-inspired crystals retain recognizable contours.
    // Side and bottom crops keep them behind the white headline.
    const silhouette = "M252 7Q275-10 299 15L383 124Q394 138 394 156Q394 245 449 310Q459 322 449 337L404 408Q387 446 383 477Q379 506 353 511Q342 515 322 508Q251 484 173 481Q168 481 159 472L66 379Q49 362 61 338L118 211L131 128Q133 111 146 99Z";
    const faces = [
        ["252,7 299,15 250,194 131,128", "#ECDEFF", .18],
        ["131,128 250,194 197,314 118,211", "#DDD0FF", .22],
        ["299,15 383,124 250,194", "#9565ED", .24],
        ["383,124 394,156 353,271 250,194", "#CFADFF", .14],
        ["394,156 449,310 353,271", "#CFB0FF", .22],
        ["250,194 353,271 277,306", "#A784ED", .13],
        ["250,194 277,306 197,314", "#F1E9FF", .23],
        ["353,271 449,310 404,408 277,306", "#BAA3FF", .18],
        ["118,211 197,314 61,338", "#6D35CE", .20],
        ["61,338 197,314 173,481", "#CFA7FF", .13],
        ["197,314 277,306 238,410 173,481", "#4B239F", .17],
        ["277,306 404,408 238,410", "#673ABD", .16],
        ["238,410 404,408 353,511", "#B093EE", .13],
        ["173,481 238,410 353,511", "#8B67D5", .12],
    ];
    const facets = `<path d="${silhouette}" fill="#BCA2F8" fill-opacity=".055"/>`
        + faces.map(([points, fill, opacity]) => `<polygon points="${points}" fill="${fill}" fill-opacity="${opacity}"/>`).join("")
        + '<path d="M299 15 250 194 277 306 197 314M277 306 353 271 449 310M197 314 238 410 353 511" fill="none" stroke="#E8D8FF" stroke-opacity=".13" stroke-width="1.5"/>';
    const crystal = (x, y, scale, opacity) => `<g transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}" clip-path="url(#hero-crystal-contour)">${facets}</g>`;
    // Sparse, irregular two-face shards occupy the empty space around the text.
    const shards = [
        ["translate(85 22) scale(1.45) rotate(-16 8.5 14)", [
            ["M8 0 17 11 7 17 0 20Z", "#DEC8FF", .12],
            ["M17 11 11 28 0 20 7 17Z", "#492C9B", .14],
        ]],
        ["translate(398 22) scale(1.3) rotate(23 4 7.5)", [
            ["M4 0 8 5 3 8 0 9Z", "#E5D7FF", .09],
            ["M8 5 3 15 0 9 3 8Z", "#492C9B", .10],
        ]],
        ["translate(468 50) scale(1.45) rotate(-7 11.5 8.5)", [
            ["M0 7 12 0 10 10 15 17Z", "#DEC8FF", .10],
            ["M12 0 23 5 15 17 10 10Z", "#492C9B", .13],
        ]],
        ["translate(200 187) scale(1.45) rotate(-24 6 11.5)", [
            ["M4 0 12 8 5 12 0 16Z", "#D8CAFF", .11],
            ["M12 8 8 23 0 16 5 12Z", "#492C9B", .12],
        ]],
        ["translate(345 201) rotate(12 11.5 6)", [
            ["M0 5 13 0 10 7 6 10Z", "#DEC8FF", .09],
            ["M13 0 23 4 17 12 6 10 10 7Z", "#492C9B", .11],
        ]],
    ].map(([transform, planes]) => `<g transform="${transform}">${planes.map(([d, fill, opacity]) => `<path d="${d}" fill="${fill}" fill-opacity="${opacity}"/>`).join("")}</g>`).join("");
    return `<defs><clipPath id="hero-crystal-contour"><path d="${silhouette}"/></clipPath></defs>`
        + crystal(464, 106, .34, .65)
        + crystal(-62, 130, .29, .48)
        + shards;
}
