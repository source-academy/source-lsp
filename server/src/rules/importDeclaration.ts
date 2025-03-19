import { AST } from "../ast";
import { Context } from "../types";
import { Rule } from "./rule";
import { ImportDeclaration, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";

export const importDeclarationRule = new class extends Rule<ImportDeclaration> {
    public process(child: ImportDeclaration, parent: Node, context: Context, ast: AST): void {
        if (ast.isDummy(child.source))
            ast.addDiagnostic("Expected module name", DiagnosticSeverity.Error, child.loc!);
    }
}();