import { AST } from "../ast";
import { Context } from "../types";
import { Rule } from "./rule";
import { ArrowFunctionExpression, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";

export const arrowFunctionExpressionRule = new class extends Rule<ArrowFunctionExpression> {
    public process(child: ArrowFunctionExpression, parent: Node, context: Context, ast: AST): void {
        let hasRestElement = false;
        for (const param of child.params) {
          if (hasRestElement) {
            ast.addDiagnostic("No params allowed after rest element", DiagnosticSeverity.Error, { start: param.loc!.start, end: child.params[child.params.length - 1].loc!.end });
            break;
          }

          hasRestElement = param.type === "RestElement";
        }
    }
}();