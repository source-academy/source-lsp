import { AST } from "../ast";
import { Rule } from "./rule";
import { IfStatement, Node } from "estree"
import { STATEMENTS } from "../types";
import { DiagnosticSeverity } from "vscode-languageserver";
import { Chapter, Context } from "../types";

export const ifStatementRule = new class extends Rule<IfStatement> {
  public process(child: IfStatement, parent: Node, context: Context, ast: AST): void {
    if (context.chapter < Chapter.SOURCE_3 && !child.alternate)
      ast.addDiagnostic(`Missing "else" in "if-else" statement`, DiagnosticSeverity.Error, { start: child.loc!.start, end: child.consequent.loc!.start });
    if (child.consequent.type !== STATEMENTS.BLOCK)
      ast.addDiagnostic("Missing curly braces around if", DiagnosticSeverity.Error, child.consequent.loc!);
    if (child.alternate && child.alternate.type !== STATEMENTS.BLOCK)
      ast.addDiagnostic("Missing curly braces around else", DiagnosticSeverity.Error, child.alternate.loc!);
  }
}();