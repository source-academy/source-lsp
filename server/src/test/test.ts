import { createContext } from "js-slang";
import { getCompletionItems, getDocumentSymbols, renameSymbol } from "../languageFeatures";
import { Chapter, Variant } from "js-slang/dist/types";
import assert from "assert";
import { autocomplete_labels, module_autocomplete } from "../utils";
import { TextDocument } from "vscode-languageserver-textdocument";

const context = createContext(Chapter.SOURCE_4, Variant.DEFAULT);

suite("Autocompletion", () => {
    test("Builtins", async () => {
        const items = await getCompletionItems(
            "",
            {line: 0, character: 0},
            context
        );
        assert.ok(autocomplete_labels[context.chapter-1].every(i => items.includes(i)));
    });

    test("Scoping1", async () => {
        const items = await getCompletionItems(
            "let x = 1; {let y = 1;}",
            {line: 0, character: 0},
            context
        );

        assert.ok(items.some(i => i.label === "x") && items.every(i => i.label !== "y"));
    })
})

suite("Rename", () => {
    test("Rename1", () => {
        const text = "let x = 1; { let x = 2; }";
        const doc = TextDocument.create("test://test/test.sourcejs", 'sourcejs', 0, text);
        const edits = renameSymbol(
            text,
            {line: 0, character: 4},
            context,
            doc.uri,
            'y'
        )

        assert.deepStrictEqual(edits, {
            changes: {
                [doc.uri]: [
                    {
                        range: { start: {line: 0, character: 4}, end: {line: 0, character: 5}},
                        newText: 'y'
                    }
                ] 
            }
        });
    });

    test("Rename2", () => {
        const text = "let x = 1; { let x = 2; x = 3; }";
        const doc = TextDocument.create("test://test/test.sourcejs", 'sourcejs', 0, text);
        const edits = renameSymbol(
            text,
            {line: 0, character: 17},
            context,
            doc.uri,
            'y'
        )

        assert.deepStrictEqual(edits, {
            changes: {
                [doc.uri]: [
                    {
                        range: { start: {line: 0, character: 17}, end: {line: 0, character: 18}},
                        newText: 'y'
                    },
                    {
                        range: { start: {line: 0, character: 24}, end: {line: 0, character: 25}},
                        newText: 'y'
                    }
                ] 
            }
        });
    }); 

    test("Rename3", () => {
        const text = "let x = 1; { x = 3; }";
        const doc = TextDocument.create("test://test/test.sourcejs", 'sourcejs', 0, text);
        const edits = renameSymbol(
            text,
            {line: 0, character: 4},
            context,
            doc.uri,
            'y'
        )

        assert.deepStrictEqual(edits, {
            changes: {
                [doc.uri]: [
                    {
                        range: { start: {line: 0, character: 4}, end: {line: 0, character: 5}},
                        newText: 'y'
                    },
                    {
                        range: { start: {line: 0, character: 13}, end: {line: 0, character: 14}},
                        newText: 'y'
                    }
                ] 
            }
        });
    }); 
});

suite("Document Symbols", () => {
    test("Imports", async () => {
        const symbols = await getDocumentSymbols(
            'import { black } from "rune"; import { black } from "rune_in_words";',
            context
        );

        assert.deepStrictEqual(symbols, [
            {
                "name": "black",
                "kind": 3,
                "range": {
                    "start": {
                        "line": 0,
                        "character": 0
                    },
                    "end": {
                        "line": 0,
                        "character": 29
                    }
                },
                "selectionRange": {
                    "start": {
                        "line": 0,
                        "character": 9
                    },
                    "end": {
                        "line": 0,
                        "character": 14
                    }
                }
            },
            {
                "name": "black",
                "kind": 3,
                "range": {
                    "start": {
                        "line": 0,
                        "character": 30
                    },
                    "end": {
                        "line": 0,
                        "character": 68
                    }
                },
                "selectionRange": {
                    "start": {
                        "line": 0,
                        "character": 39
                    },
                    "end": {
                        "line": 0,
                        "character": 44
                    }
                }
            }
        ]
        )
    });

    test("Variables", async () => {
        const symbols = await getDocumentSymbols(
            'let x = 1; { let y = 2; }',
            context
        )

        assert.deepStrictEqual(symbols, [
            {
                "name": "x",
                "kind": 13,
                "range": {
                    "start": {
                        "line": 0,
                        "character": 4
                    },
                    "end": {
                        "line": 0,
                        "character": 9
                    }
                },
                "selectionRange": {
                    "start": {
                        "line": 0,
                        "character": 4
                    },
                    "end": {
                        "line": 0,
                        "character": 5
                    }
                }
            },
            {
                "name": "y",
                "kind": 13,
                "range": {
                    "start": {
                        "line": 0,
                        "character": 17
                    },
                    "end": {
                        "line": 0,
                        "character": 22
                    }
                },
                "selectionRange": {
                    "start": {
                        "line": 0,
                        "character": 17
                    },
                    "end": {
                        "line": 0,
                        "character": 18
                    }
                }
            }
        ]
        )
    });

    test("Functions", async() => {
        const symbols = await getDocumentSymbols(
            `const mult = (x, y) => {
                return x * y;
            }`,
            context
        );

        assert.deepEqual(symbols, [
            {
                "name": "mult",
                "kind": 14,
                "range": {
                    "start": {
                        "line": 0,
                        "character": 6
                    },
                    "end": {
                        "line": 2,
                        "character": 13
                    }
                },
                "selectionRange": {
                    "start": {
                        "line": 0,
                        "character": 6
                    },
                    "end": {
                        "line": 0,
                        "character": 10
                    }
                }
            }
        ]
        )
    })
})