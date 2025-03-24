import { AST } from "../ast";
import { Rule } from "./rule";
import { TemplateLiteral, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";
import { Context } from "../types";

export const templateLiteralRule = new class extends Rule<TemplateLiteral> {
    public process(child: TemplateLiteral, parent: Node, context: Context, ast: AST): void {
        child.expressions.forEach(expression => {
            ast.addDiagnostic("Expressions not allowed in template literal", DiagnosticSeverity.Error, expression.loc!);
        })
    }
}();
