import { AST } from "../ast";
import { Rule } from "./rule";
import { BreakStatement, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";
import { Chapter, Context } from "../types";

export const breakStatementRule = new class extends Rule<BreakStatement> {
    public process(child: BreakStatement, parent: Node, context: Context, ast: AST): void {
        if (context.chapter < Chapter.SOURCE_3) 
            ast.addDiagnostic("Break statements are not allowed", DiagnosticSeverity.Error, child.loc!)
    }
}();