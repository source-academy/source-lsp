import { AST } from "../ast";
import { Rule } from "./rule";
import { WhileStatement, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";
import { STATEMENTS } from "../types";
import { Chapter, Context } from "../types";

export const whileStatementRule = new class extends Rule<WhileStatement> {
    public process(child: WhileStatement, parent: Node, context: Context, ast: AST): void {
        if (context.chapter < Chapter.SOURCE_3)
            ast.addDiagnostic("While statements are not allowed", DiagnosticSeverity.Error, { start: child.loc!.start, end: child.body.loc!.start })
        if (child.body.type !== STATEMENTS.BLOCK)
            ast.addDiagnostic("Missing curly braces around while", DiagnosticSeverity.Error, { start: child.loc!.start, end: child.body.loc!.start });
    }
}();