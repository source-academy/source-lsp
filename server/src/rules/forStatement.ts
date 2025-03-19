import { AST } from "../ast";
import { Chapter, Context } from "../types";
import { Rule } from "./rule";
import { ForStatement, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";
import { STATEMENTS } from "../types";

export const forStatementRule = new class extends Rule<ForStatement> {
  public process(child: ForStatement, parent: Node, context: Context, ast: AST): void {
    if (context.chapter < Chapter.SOURCE_3)
      ast.addDiagnostic("For statements are not allowed", DiagnosticSeverity.Error, { start: child.loc!.start, end: child.body.loc!.start })
    if (child.body.type !== STATEMENTS.BLOCK)
      ast.addDiagnostic("Missing curly braces around for", DiagnosticSeverity.Error, child.loc!);
    if (!(child.init && child.test && child.update))
      ast.addDiagnostic("Incomplete for loop", DiagnosticSeverity.Error, { start: child.loc!.start, end: child.body.loc!.start })
  }
}();