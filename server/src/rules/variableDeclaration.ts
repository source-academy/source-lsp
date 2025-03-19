import { AST } from "../ast";
import { Rule } from "./rule";
import { VariableDeclaration, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";
import { Chapter, Context } from "../types";

export const variableDeclarationRule = new class extends Rule<VariableDeclaration> {
  public process(child: VariableDeclaration, parent: Node, context: Context, ast: AST): void {
    if (child.declarations.length > 1)
      ast.addDiagnostic("Multiple declarations not allowed", DiagnosticSeverity.Error, child.loc!)
    child.declarations.forEach(declaration => {
      ast.checkIncompleteLeftRightStatement(declaration.id, declaration.init, child.loc!, "Incomplete variable declaration");

    });

    if (context.chapter < Chapter.SOURCE_3 && child.kind !== "const")
      ast.addDiagnostic(`Use keyword "const" instead to declare a constant`, DiagnosticSeverity.Error, child.loc!);
  }
}();