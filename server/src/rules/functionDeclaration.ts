import { Context } from "js-slang/dist/types";
import { AST } from "../ast";
import { Rule } from "./rule";
import { FunctionDeclaration, Identifier, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";
import { NODES } from "../types";

export const functionDeclarationRule = new class extends Rule<FunctionDeclaration> {
    public process(child: FunctionDeclaration, parent: Node, context: Context, ast: AST): void {
        if (child.id !== null && ast.isDummy(child.id))
          ast.addDiagnostic("Missing function name", DiagnosticSeverity.Error, child.loc!)

        let hasRestElement = false;
        for (const param of child.params) {
          if (hasRestElement) {
            ast.addDiagnostic("No params allowed after rest element", DiagnosticSeverity.Error, { start: param.loc!.start, end: child.params[child.params.length - 1].loc!.end });
            break;
          }

          hasRestElement = param.type === "RestElement";
        }

        const paramNames = new Set();
        for (const param of child.params) {
          if (param.type === NODES.IDENTIFIER || (param.type === NODES.REST && param.argument.type === NODES.IDENTIFIER)) {
            const name = param.type === NODES.IDENTIFIER ? param.name : (param.argument as Identifier).name;

            if (paramNames.has(name))
              ast.addDiagnostic("No duplicate param names", DiagnosticSeverity.Error, param.loc!);
            else
              paramNames.add(name);
          }
        }

    }
}();