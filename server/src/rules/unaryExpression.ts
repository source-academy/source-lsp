import { AST } from "../ast";
import { Rule } from "./rule";
import { UnaryExpression, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";
import { Context } from "../types";

export const unaryExpressionRule = new class extends Rule<UnaryExpression> {
    private permitted_operators = ['-', '!'];

    public process(child: UnaryExpression, parent: Node, context: Context, ast: AST): void {
        if (!this.permitted_operators.includes(child.operator))
            ast.addDiagnostic(`${child.operator} operator is not allowed`, DiagnosticSeverity.Error, child.loc!);
    }
}();