import { Chapter, Context } from "js-slang/dist/types";
import { AST } from "../ast";
import { Rule } from "./rule";
import { ArrayExpression, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";

export const arrayExpressionRule = new class extends Rule<ArrayExpression> {
    public process(child: ArrayExpression, parent: Node, context: Context, ast: AST): void {
        if (context.chapter < Chapter.SOURCE_3)
            ast.addDiagnostic("Array expressions are not allowed", DiagnosticSeverity.Error, child.loc!);
        if (child.elements.some(x => x === null))
            ast.addDiagnostic("No holes are allowed in array literals", DiagnosticSeverity.Error, child.loc!);
    }
}();