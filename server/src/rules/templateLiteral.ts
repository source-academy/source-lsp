import { Context } from "js-slang/dist/types";
import { AST } from "../ast";
import { Rule } from "./rule";
import { TemplateLiteral, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";

export const templateLiteralRule = new class extends Rule<TemplateLiteral> {
    public process(child: TemplateLiteral, parent: Node, context: Context, ast: AST): void {
        if (child.expressions.length > 0)
            ast.addDiagnostic("Expressions not allowed in template literal", DiagnosticSeverity.Error, child.loc!);
    }
}();
