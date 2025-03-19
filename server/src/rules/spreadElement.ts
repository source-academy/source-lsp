import { AST } from "../ast";
import { Rule } from "./rule";
import { SpreadElement, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";
import { Context } from "../types";

export const spreadElementRule = new class extends Rule<SpreadElement> {
    public process(child: SpreadElement, parent: Node, context: Context, ast: AST): void {
        if (parent.type !== "CallExpression")
            ast.addDiagnostic("Spread syntax is only allowed when supplying arguments to a function", DiagnosticSeverity.Error, child.loc!)
    }
}();