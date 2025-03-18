import { Node } from 'estree';
import { DECLARATIONS, EXPRESSIONS, NODES, STATEMENTS } from '../types';
import { Rule } from './rule';
import { binaryExpressionRule } from './binaryExpression';
import { conditonalExpressionRule } from './conditionalExpression';
import { literalRule } from './literalExpression';
import { variableDeclarationRule } from './variableDeclaration';
import { assignmentExpressionRule } from './assignmentExpression';
import { functionDeclarationRule } from './functionDeclaration';
import { callExpressionRule } from './callExpression';
import { identifierRule } from './identifier';
import { importDeclarationRule } from './importDeclaration';
import { forStatementRule } from './forStatement';
import { ifStatementRule } from './ifStatement';
import { whileStatementRule } from './whileStatement';
import { memberExpressionRule } from './memberExpression';
import { arrayExpressionRule } from './arrayExpression';
import { breakStatementRule } from './breakStatement';
import { continueStatementRule } from './continueStatement';
import { returnStatementRule } from './returnStatement';
import { spreadElementRule } from './spreadElement';
import { templateLiteralRule } from './templateLiteral';
import { unaryExpressionRule } from './unaryExpression';

export const rules: Map<string, Rule<Node>> = new Map();
export const bannedNodes = new Set([
    "ExportDefaultDeclaration",
    "SwitchStatement",
    "TryStatement",
    "ClassDeclaration",
    "DoWhileStatement",
    "NewExpression",
    "ThisExpression",
    "ThrowStatement",
    "WithStatement",
    "ObjectExpression"
]);

rules.set(EXPRESSIONS.BINARY, binaryExpressionRule);
rules.set(EXPRESSIONS.UNARY, unaryExpressionRule);
rules.set(EXPRESSIONS.CONDITIONAL, conditonalExpressionRule);
rules.set(EXPRESSIONS.ASSIGNMENT, assignmentExpressionRule);
rules.set(EXPRESSIONS.CALL, callExpressionRule);
rules.set(EXPRESSIONS.MEMBER, memberExpressionRule);
rules.set(EXPRESSIONS.ARRAY, arrayExpressionRule);

rules.set(DECLARATIONS.VARIABLE, variableDeclarationRule);
rules.set(DECLARATIONS.FUNCTION, functionDeclarationRule);
rules.set(DECLARATIONS.IMPORT, importDeclarationRule);

rules.set(STATEMENTS.FOR, forStatementRule);
rules.set(STATEMENTS.IF, ifStatementRule);
rules.set(STATEMENTS.WHILE, whileStatementRule);
rules.set(STATEMENTS.BREAK, breakStatementRule);
rules.set(STATEMENTS.CONTINUE, continueStatementRule);
rules.set(STATEMENTS.RETURN, returnStatementRule);

rules.set(NODES.LITERAL, literalRule);
rules.set(NODES.TEMPLATE_LITERAL, templateLiteralRule);
rules.set(NODES.IDENTIFIER, identifierRule);
rules.set(NODES.SPREAD, spreadElementRule);