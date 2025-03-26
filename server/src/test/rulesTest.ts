import assert from "assert";
import { AST } from "../ast";
import { Chapter, Context } from "../types";

const contexts: Context[] = [
    { chapter: Chapter.SOURCE_1 },
    { chapter: Chapter.SOURCE_2 },
    { chapter: Chapter.SOURCE_3 },
    { chapter: Chapter.SOURCE_4 }
]

suite("Warnings", () => {
    test("No unused variables", () => {
        const context = contexts[0];
        const program = `const pi = 3.14;display(5*5*3.14);`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Unused name", "severity": 2, "range": { "start": { "line": 0, "character": 6 }, "end": { "line": 0, "character": 8 } }, "tags": [1], "source": "Source 1" }]
        );
    });

    test("No unused variables (scoping)", () => {
        const context = contexts[0];
        const program = `const x = 1; {const x = 2; display(x);}`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Unused name", "severity": 2, "range": { "start": { "line": 0, "character": 6 }, "end": { "line": 0, "character": 7 } }, "tags": [1], "source": "Source 1" }]
        );
    });
})

suite("Errors", () => {
    test("Missing semicolon", () => {
        const context = contexts[0];
        const program = `const x = 1; x`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Missing semicolon", "severity": 1, "range": { "start": { "line": 0, "character": 14 }, "end": { "line": 0, "character": 15 } }, "source": "Source 1" }]
        );
    });
    test("Trailing comma", () => {
        const context = contexts[3];
        const program = `[1,2,3,];`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Trailing comma", "severity": 1, "range": { "start": { "line": 0, "character": 6 }, "end": { "line": 0, "character": 7 } }, "source": "Source 4" }]
        );
    });

    test("No namespace/default imports", () => {
        const context = contexts[0];
        const program = `import * as rune from "rune";
import black from "rune";`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Only normal imports are allowed", "severity": 1, "range": { "start": { "line": 0, "character": 7 }, "end": { "line": 0, "character": 16 } }, "tags": [], "source": "Source 1" }, { "message": "Only normal imports are allowed", "severity": 1, "range": { "start": { "line": 1, "character": 7 }, "end": { "line": 1, "character": 12 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("Unexpected token in function parameters", () => {
        const context = contexts[0];
        const program = "(a+b) => {}"
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Unexpected token", "severity": 1, "range": { "start": { "line": 0, "character": 1 }, "end": { "line": 0, "character": 4 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("Redeclaration of variables", () => {
        const context = contexts[3];
        const program = `let x = 1;
let x = 2;
x;`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Identifier 'x' has already been declared", "severity": 1, "range": { "start": { "line": 1, "character": 4 }, "end": { "line": 1, "character": 5 } }, "tags": [], "source": "Source 4" }]
        );
    });
    test("No array expressions (before source 3)", () => {
        const context = contexts[0];
        const program = "[1,2,3];"
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Array expressions are not allowed", "severity": 1, "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 7 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("No empty elements", () => {
        const context = contexts[3];
        const program = `[1,,3];`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "No holes are allowed in array literals", "severity": 1, "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 6 } }, "tags": [], "source": "Source 4" }]
        );
    });

    test("Const reassignment", () => {
        const context = contexts[0];
        const program = `const x = 1;
function reassign() {
    x = 2;
}
reassign();`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Cannot assign new value to constant x", "severity": 1, "range": { "start": { "line": 2, "character": 4 }, "end": { "line": 2, "character": 5 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("Incomplete binary expression", () => {
        const context = contexts[0];
        const program = `10 + (5 / );`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Incomplete binary expression", "severity": 1, "range": { "start": { "line": 0, "character": 6 }, "end": { "line": 0, "character": 10 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("Force strict equality", () => {
        const context = contexts[0];
        const program = `true == 1;`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Use === instead of ==", "severity": 1, "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 9 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("Disallowed operators", () => {
        const context = contexts[3];
        const program = `100^5;
typeof 1 === "number";`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "^ operator is not allowed", "severity": 1, "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 5 } }, "tags": [], "source": "Source 4" }, { "message": "typeof operator is not allowed", "severity": 1, "range": { "start": { "line": 1, "character": 0 }, "end": { "line": 1, "character": 8 } }, "tags": [], "source": "Source 4" }]
        );
    });

    test("Only string or number in equality checks (before source 3)", () => {
        const context = contexts[0];
        const program = `true === 1;
true === (1 === 1);
(1 === 1) === undefined;
"string" === 1;`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Expected string or number on left hand side of operation, got boolean", "severity": 1, "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 4 } }, "tags": [], "source": "Source 1" }, { "message": "Expected string or number on left hand side of operation, got boolean", "severity": 1, "range": { "start": { "line": 1, "character": 0 }, "end": { "line": 1, "character": 4 } }, "tags": [], "source": "Source 1" }, { "message": "Expected string or number on right hand side of operation, got undefined", "severity": 1, "range": { "start": { "line": 2, "character": 14 }, "end": { "line": 2, "character": 23 } }, "tags": [], "source": "Source 1" }, { "message": "Expected string on right hand side of operation, got number", "severity": 1, "range": { "start": { "line": 3, "character": 13 }, "end": { "line": 3, "character": 14 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("No break statements (before source 3)", () => {
        const context = contexts[0];
        const program = `break;`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Break statements are not allowed", "severity": 1, "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 6 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("Calling a non function", () => {
        const context = contexts[3];
        const program = `const x = 1;
x();
let y = 1;
y();`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "'x' is not a function", "severity": 1, "range": { "start": { "line": 1, "character": 0 }, "end": { "line": 1, "character": 1 } }, "tags": [], "source": "Source 4" }]
        );
    });

    test("Not enough parameters", () => {
        const context = contexts[0];
        const program = `display();`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Expected between 1 and 2 arguments, but got 0", "severity": 1, "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 7 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("Incomplete ternary expression", () => {
        const context = contexts[0];
        const program = `b => b ? 1;`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Incomplete ternary", "severity": 1, "range": { "start": { "line": 0, "character": 5 }, "end": { "line": 0, "character": 10 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("No continue statements (before source 3)", () => {
        const context = contexts[0];
        const program = `continue;`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Continue statements are not allowed", "severity": 1, "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 9 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("No for statements (before source 3)", () => {
        const context = contexts[0];
        const program = `for (let i = 0; i < 10; i++;) {}`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "For statements are not allowed", "severity": 1, "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 30 } }, "tags": [], "source": "Source 1" }, { "message": "Use keyword \"const\" instead to declare a constant", "severity": 1, "range": { "start": { "line": 0, "character": 5 }, "end": { "line": 0, "character": 14 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("Missing block statements", () => {
        const context = contexts[3];
        const program = `for (let i = 0; i < 10; i++;)
while (true)
if (1 === 1)
    display("1 is equal to 1");
else
    display("1 is not equal to 1");`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Missing curly braces around for", "severity": 1, "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 1, "character": 0 } }, "tags": [], "source": "Source 4" }, { "message": "Missing curly braces around while", "severity": 1, "range": { "start": { "line": 1, "character": 0 }, "end": { "line": 2, "character": 0 } }, "tags": [], "source": "Source 4" }, { "message": "Missing curly braces around if", "severity": 1, "range": { "start": { "line": 3, "character": 4 }, "end": { "line": 3, "character": 31 } }, "tags": [], "source": "Source 4" }, { "message": "Missing curly braces around else", "severity": 1, "range": { "start": { "line": 5, "character": 4 }, "end": { "line": 5, "character": 35 } }, "tags": [], "source": "Source 4" }]
        );
    });

    test("Incomplete for loop", () => {
        const context = contexts[3];
        const program = `for (let i = 0; i < 10;) {}`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Incomplete for loop", "severity": 1, "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 25 } }, "tags": [], "source": "Source 4" }]
        );
    });

    test("Missing function name", () => {
        const context = contexts[0];
        const program = `function () {}`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "Missing function name", "severity": 1, "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 14 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("Terminal rest element", () => {
        const context = contexts[0];
        const program = `function foo(arg1, ...arg2, arg3) { arg1;arg2;arg3 }
(arg1, ...arg2, arg3) => { arg1; arg2; arg3};
foo;`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{ "message": "No params allowed after rest element", "severity": 1, "range": { "start": { "line": 0, "character": 28 }, "end": { "line": 0, "character": 32 } }, "tags": [], "source": "Source 1" }, { "message": "No params allowed after rest element", "severity": 1, "range": { "start": { "line": 1, "character": 16 }, "end": { "line": 1, "character": 20 } }, "tags": [], "source": "Source 1" }]
        );
    });

    test("Identifer not declared", () => {
        const context = contexts[0];
        const program = `{
  const x = 1;
  {
    display(x);
  }
}
display(x);`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"Name 'x' not declared","severity":1,"range":{"start":{"line":6,"character":8},"end":{"line":6,"character":9}},"tags":[],"source":"Source 1"}]
        )
    });

    test("Missing else case (before source 3)", () => {
        const context = contexts[0];
        const program = `if (true) {
  display("hello world");
}`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"Missing \"else\" in \"if-else\" statement","severity":1,"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":10}},"tags":[],"source":"Source 1"}]
        );
    });

    test("Missing module name", () => {
        const context = contexts[0];
        const program = `import { black };`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"Expected module name","severity":1,"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":17}},"tags":[],"source":"Source 1"}]
        );
    });

    test("Missing closing string", () => {
        const context = contexts[0];
        const program = `"hello world
";`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"Incomplete string expression","severity":1,"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":12}},"tags":[],"source":"Source 1"},{"message":"Incomplete string expression","severity":1,"range":{"start":{"line":1,"character":0},"end":{"line":1,"character":2}},"tags":[],"source":"Source 1"}]
        );
    });

    test("No null literals (in source 1)", () => {
        const context = contexts[0];
        const program = `display(null);`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"Null literals not allowed","severity":1,"range":{"start":{"line":0,"character":8},"end":{"line":0,"character":12}},"tags":[],"source":"Source 1"}]
        );
    });

    test("No member access (before source 3)", () => {
        const context = contexts[0];
        const program = `"hello world"[0];`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"Member access expressions are not allowed","severity":1,"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":16}},"tags":[],"source":"Source 1"}]
        );
    });

    test("No dot abbreviations", () => {
        const context = contexts[0];
        const program = `display("hello world".);`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"No dot abbreviations","severity":1,"range":{"start":{"line":0,"character":8},"end":{"line":0,"character":22}},"tags":[],"source":"Source 1"}]
        );
    });

    test("Non integer member access", () => {
        const context = contexts[3];
        const program = `const arr = [1,2,3];
arr[undefined];
arr["test"];
arr[1.1];
arr[-1];`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"Expected non negative integer as array index, got undefined.","severity":1,"range":{"start":{"line":1,"character":4},"end":{"line":1,"character":13}},"tags":[],"source":"Source 4"},{"message":"Expected non negative integer as array index, got string.","severity":1,"range":{"start":{"line":2,"character":4},"end":{"line":2,"character":10}},"tags":[],"source":"Source 4"},{"message":"Expected non negative integer as array index, got float.","severity":1,"range":{"start":{"line":3,"character":4},"end":{"line":3,"character":7}},"tags":[],"source":"Source 4"},{"message":"Expected non negative integer as array index, got negative number.","severity":1,"range":{"start":{"line":4,"character":4},"end":{"line":4,"character":6}},"tags":[],"source":"Source 4"}]
        );
    });

    test("No return value", () => {
        const context = contexts[0];
        const program = `function foo() { return; }
foo();`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"Missing value in return statement","severity":1,"range":{"start":{"line":0,"character":17},"end":{"line":0,"character":24}},"tags":[],"source":"Source 1"}]
        );
    });

    test("No spread syntax", () => {
        const context = contexts[3];
        const program = `const x = [1,2,3];
display(list(...x));
...x;`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"Spread syntax is only allowed when supplying arguments to a function","severity":1,"range":{"start":{"line":2,"character":0},"end":{"line":2,"character":4}},"tags":[],"source":"Source 4"}]
        );
    });

    test("No expressions in template literals", () => {
        const context = contexts[0];
        const program = "display(`10 * 10 = ${10*10}`);"
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"Expressions not allowed in template literal","severity":1,"range":{"start":{"line":0,"character":21},"end":{"line":0,"character":26}},"tags":[],"source":"Source 1"}]
        );
    });

    test("No multiple declarations", () => {
        const context = contexts[0];
        const program = "const x = 1, y = 2, z = 3;x;y;z;"
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"Multiple declarations not allowed","severity":1,"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":26}},"tags":[],"source":"Source 1"}]
        );
    });

    test("Incomplete variable declaration", () => {
        const context = contexts[0];
        const program = "const x;x;"
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"Incomplete variable declaration","severity":1,"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":8}},"tags":[],"source":"Source 1"}]
        );
    });

    test("No let declaration (before source 3)", () => {
        const context = contexts[0];
        const program = "let x = 1;x;"
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"Use keyword \"const\" instead to declare a constant","severity":1,"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":10}},"tags":[],"source":"Source 1"}]
        );
    });

    test("No while statement (before source 3)", () => {
        const context = contexts[0];
        const program = `while (true) { display("hi"); }`
        const ast = new AST(program, context, "");
        const diagnostics = ast.getDiagnostics();
        assert.deepStrictEqual(
            diagnostics,
            [{"message":"While statements are not allowed","severity":1,"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":13}},"tags":[],"source":"Source 1"}]
        );
    });
})
