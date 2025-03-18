import { Context } from "js-slang/dist/types";
import { AST } from "../ast";
import { Rule } from "./rule";
import { ReturnStatement, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";

export const returnStatementRule = new class extends Rule<ReturnStatement> {
    public process(child: ReturnStatement, parent: Node, context: Context, ast: AST): void {
        if (!child.argument)
            ast.addDiagnostic("Missing value in return statement", DiagnosticSeverity.Error, child.loc!);
    }
}();