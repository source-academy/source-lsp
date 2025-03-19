import { AST } from "../ast";
import { Context } from "../types";
import { Rule } from "./rule";
import { AssignmentExpression, Identifier, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";

export const assignmentExpressionRule = new class extends Rule<AssignmentExpression> {
    public process(child: AssignmentExpression, parent: Node, context: Context, ast: AST): void {
        if (child.left.type === "Identifier" && !ast.isDummy(child.left)) {
          // Declaration might not have been processed yet
          ast.addDiagnosticCallback((node: Node) => {
            const identifier = node as Identifier;
            if (identifier.loc) {
              const declaration = ast.findDeclarationByName(identifier.name, identifier.loc);
              if (declaration !== undefined && (declaration.meta === "const" || declaration.meta === "func"))
                ast.addDiagnostic(`Cannot assign new value to constant ${identifier.name}`, DiagnosticSeverity.Error, identifier.loc);
            }
          }, child.left)
        }

    }
}();