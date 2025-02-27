import { createContext } from "js-slang";
import { Chapter, Variant } from "js-slang/dist/types";
import assert from "assert";
import { autocomplete_labels } from "../utils";
import { TextDocument } from "vscode-languageserver-textdocument";
import { AST } from "../ast";

const context = createContext(Chapter.SOURCE_4, Variant.DEFAULT);

suite("Autocompletion", () => {
    test("Builtins", async () => {
        const ast = new AST("", context, "");
        const items = ast.getCompletionItems(
            { line: 0, character: 0 }
        );
        assert.ok(autocomplete_labels[context.chapter - 1].every(i => items.includes(i)));
    });

    test("Scoping", async () => {
        const ast = new AST("let x = 1; {let y = 1;}", context, "");
        const items = ast.getCompletionItems(
            { line: 0, character: 0 }
        );

        assert.ok(items.some(i => i.label === "x") && items.every(i => i.label !== "y"));
    })
})

suite("Rename", () => {
    test("Rename1", () => {
        const text = "let x = 1; { let x = 2; }";
        const doc = TextDocument.create("test://test/test.sourcejs", 'sourcejs', 0, text);
        const ast = new AST(text, context, doc.uri);
        const edits = ast.renameSymbol(
            { line: 0, character: 4 },
            'y'
        )

        assert.deepStrictEqual(edits, {
            changes: {
                [doc.uri]: [
                    {
                        range: { start: { line: 0, character: 4 }, end: { line: 0, character: 5 } },
                        newText: 'y'
                    }
                ]
            }
        });
    });

    test("Rename2", () => {
        const text = "let x = 1; { let x = 2; x = 3; }";
        const doc = TextDocument.create("test://test/test.sourcejs", 'sourcejs', 0, text);
        const ast = new AST(text, context, doc.uri);
        const edits = ast.renameSymbol(
            { line: 0, character: 17 },
            'y'
        )

        assert.deepStrictEqual(edits, {
            changes: {
                [doc.uri]: [
                    {
                        range: { start: { line: 0, character: 17 }, end: { line: 0, character: 18 } },
                        newText: 'y'
                    },
                    {
                        range: { start: { line: 0, character: 24 }, end: { line: 0, character: 25 } },
                        newText: 'y'
                    }
                ]
            }
        });
    });

    test("Rename3", () => {
        const text = "let x = 1; { x = 3; }";
        const doc = TextDocument.create("test://test/test.sourcejs", 'sourcejs', 0, text);
        const ast = new AST(text, context, doc.uri);
        const edits = ast.renameSymbol(
            { line: 0, character: 4 },
            'y'
        )

        assert.deepStrictEqual(edits, {
            changes: {
                [doc.uri]: [
                    {
                        range: { start: { line: 0, character: 4 }, end: { line: 0, character: 5 } },
                        newText: 'y'
                    },
                    {
                        range: { start: { line: 0, character: 13 }, end: { line: 0, character: 14 } },
                        newText: 'y'
                    }
                ]
            }
        });
    });
});

suite("Document Symbols", () => {
    test("Imports", async () => {
        const ast = new AST(
            'import { black } from "rune"; import { black } from "rune_in_words";',
            context,
            ""
        );

        assert.deepStrictEqual(ast.getDocumentSymbols(), [
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
        const ast = new AST(
            'let x = 1; { let y = 2; }',
            context,
            ""
        )

        assert.deepStrictEqual(ast.getDocumentSymbols(), [
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

    test("Functions", async () => {
        const ast = new AST(
            `const mult = (x, y) => {
                return x * y;
            }`,
            context,
            ""
        );


        assert.deepEqual(ast.getDocumentSymbols(), [
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
                },
                "children": [
                    {
                        "name": "x",
                        "kind": 13,
                        "range": {
                            "start": {
                                "line": 0,
                                "character": 14
                            },
                            "end": {
                                "line": 0,
                                "character": 15
                            }
                        },
                        "selectionRange": {
                            "start": {
                                "line": 0,
                                "character": 14
                            },
                            "end": {
                                "line": 0,
                                "character": 15
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
                                "character": 18
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
            }
        ]
        )
    })
})