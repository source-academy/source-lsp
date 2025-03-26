# Rules
Documentation for all diagnostics sent back to the client.
## Warnings

### [No unused variables](ast.ts)
**Error message**: `Unused name`

Flags variables that are declared but not used within the code.
```javascript
const pi = 3.14;
display(5*5*3.14);
```
The variable `pi` should have a warning.

## Errors

### [Missing semicolon](ast.ts)  
**Error message**: `Missing semicolon`

Identifies statements that are missing semicolons.
```javascript
const x = 1
```
The line ending should have an error.

### [Trailing comma](ast.ts)  
**Error message**: `Trailing comma`

Identifies expressions that have trailing commas.
```javascript
const x = [1,2,3,];
```
The comma after `3` should have an error.

### [No namespace/default imports](ast.ts)  
**Error message**: `Only normal imports are allowed`

Bans namespace and default imports.
```javascript
import * as rune from "rune";
import black from "rune";
```
Both lines will throw an error around the identifier.

### [Unexpected token in function parameters](ast.ts) 
**Error message**: `Unexpected token`

Only allows identifiers as function parameters
```javascript
function foo(a+b) {}
```
`a+b` will throw an error.

### [Redeclaration of variables](ast.ts)  
**Error message**: `Identifier '${name}' has already been declared`

Bans redeclaration of names in the same scope
```javascript
let x = 1;
let x = 2;
```
The second `x` will throw an error.

### [No array expressions](rules/arrayExpression.ts)  
**Error message**: `Array expressions are not allowed`

Bans array expressions before Source 3
```javascript
const x = [1,2,3];
```
The array `[1,2,3];` will throw an error.

### [No empty elements](rules/arrayExpression.ts)
**Error message**: `No holes are allowed in array literals`

Bans empty elements in array expressions
```javascript
[1,,3];
```
The array `[1,,3]` will throw an error.

### [Constant reassignment](rules/assignmentExpression.ts)
**Error message**: `Cannot assign new value to constant ${name}`

Bans reassignment to constant variable
```javascript
const x = 1;
x = 2;
```
The second `x` will throw an error

### [Incomplete binary expression](rules/binaryExpression.ts)
**Error message**: `Incomplete binary expression`

Detects when a binary expression is missing a left/right node
```javascript
10 + ;
5 === ;
```
Both lines will throw an error

### [Force strict equality](rules/binaryExpression.ts)
**Error message**: `Use ===/!== instead of ==/!=`

Bans the use of loose equality checks `==` and `!=`
```javascript
true == 1;
```

### [Disallowed operators](rules/binaryExpression.ts)
**Error message**: `${operator} is not allowed`

Only permitted operators defined in Source is allowed. Binary operators like `^` or `instanceof` is banned, unary operators like `typeof` is also banned.
```javascript
100^5;
typeof 1 === "number"
```
The two expressions will throw an error.

### [Only string or number in equality checks](rules/binaryExpression.ts)
**Error message**: `Expected string or number on left/right hand side of operation, got ${type}`

Before Source 3, only strings or numbers can be in equality checks
```javascript
true === 1; // Expected string or number on left hand side of operation, got boolean
true === (1 === 1); // Expected string or number on left hand side of operation, got boolean
(1 === 1) === undefined; // Expected string or number on right hand side of operation, got undefined
"string" === 1; // Expected string on left hand side of operation, got number
```
Errors are shown in the comments.

### [No break statements](rules/breakStatement.ts)
**Error message**: `Break statements are not allowed;`

No break statements before Source 3
```javascript
break;
```
`break` will throw an error.

### [Calling a non function](rules/callExpression.ts)  
**Error message**: `${name} is not a function`

Cannot call identifiers that are not a function
```javascript
const x = 1;
x();
let y = 1;
y()
```
The function application on `x` will throw an error, however the function application on `y` will not, as y 
can be reassigned, hence it will be a runtime error.

### [Not enough parameters](rules/callExpression.ts)  
**Error message**: `Expected ${num_args} or more arguments, but got ${num_supplied_args}`

Detects when a function application has not enough parameters. Currently does not work for anonymous lambdas.
```javascript
display();
```
The call to `display` needs at least 1 element.

### [Incomplete ternary](rules/conditionalExpression.ts)  
**Error message**: `Incomplete ternary`

Detects when a ternary does not have a consequent or alternate case.
```javascript
b => b ? 1;
```
`b ? 1` throws an error, as there is no alternate case.

### [No continue statements](rules/continueStatement.ts)
**Error message**: `Continue statements are not allowed`

Bans continue statements before Source 3
```javascript
continue;
```
`continue` will throw an error.

### [No for statements](rules/forStatement.ts)
**Error message**: `For statements are not allowed`

Bans for statements before Source 3
```javascript
for(let i = 0; i < 10; i++) {}
```
`for(...)` will throw an error.

### [Missing block statements](rules/forStatement.ts)
**Error message**: `Missing curly braces around for/while/if/else`

Detects missing curly braces for some statements
```javascript
if (1 === 1)
  display("1 is equal to 1");
```
The whole expression will throw an error.

### [Incomplete for loop](rules/forStatement.ts)
**Error message**: `Incomplete for loop`

Detects if a for loop is missing any parts
```javascript
for (let i = 0; i < 10;) {
}
```
`for(...)` will throw an error.

### [Missing function name](rules/functionDeclaration.ts)  
**Error message**: `Missing function name`

Detects if function declaration is incomplete
```javascript
function () {}
```
The whole expression will throw an error.

### [Terminal rest element](rules/functionDeclaration.ts)  
**Error message**: `No params allowed after rest element`

If a function has a rest parameter, it must be the last parameter.
```javascript
function foo(arg1, ...arg2, arg3) {}
(arg1, ...arg2, arg3) => {};
```
Both cases will throw an error around `arg3`

### [Identifier not declared](rules/identifier.ts)
**Error message**: `Name ${name} not declared`

Detects if there is a declaration for an identifier in its scope.
```javascript
{
  const x = 1;
  {
    display(x);
  }
}
display(x);
```
The first `x` in `display(x)` should not throw an error, but the second one should.

### [Missing else case](rules/ifStatement.ts)  
**Error message**: `Missing "else" in "if-else" statement`

`else` case is required in an if statement before Source 3
```javascript
if (true) {
  display("hello world");
}
```
An error will be thrown around the body of the if statement.

### [No module name](rules/importDeclaration.ts)
**Error message**: `Expected module name`

Imports require the module name.
```javascript
import { black }
```
An error will be thrown around the whole import statement.

### [Missing closing string](rules/literal.ts)  
**Error message**: `Incomplete string expression`

Strings must be closed within the same line
```javascript
"hello world
";
```
An error will be thrown on both lines.

### [No null literals](rules/literal.ts)  
**Error message**: `Null literals are not allowed`

Nulls are not allowed in Source 1.
```javascript
display(null);
```
An error will be thrown around `null`.

### [No member access](rules/memberExpression.ts)  
**Error message**: `Member access expressions are not allowed`

Member access with square brackets `[]` is not allowed before source 3.
```javascript
"hello world"[0];
```
An error will be thrown around the whole expression.

### [No dot abbreviations](rules/memberExpression.ts)  
**Error message**: `No dot abbreviations`

Source prohibits usage of dot access in any case.
```javascript
display("hello world".length);
```
An error will be thrown around the whole expression.

### [Non integer member access](rules/memberExpression.ts)  
**Error message**: `Expected integer as array index, got ${type}`

Array access must use non negative integers
```javascript
const arr = [1,2,3];
arr[undefined]; // Expected non negative integer as array index, got undefined.
arr["test"]; // Expected non negative integer as array index, got string.
arr[1.1]; // Expected non negative integer as array index, got float.
arr[-1]; // Expected non negative integer as array index, got negative number.
```
Errors are shown in the comments.

### [No return value](rules/returnStatement.ts)  
**Error message**: `Missing value in return statement`

Returns statements must return a value in Source.
```javascript
function foo() {
  return;
}
```
An error will be thrown around the `return` statement.

### [No spread syntax](rules/spreadElement.ts)  
**Error message**: `Spread syntax is only allowed when supplying arguments to a function`

The spread syntax `...` can only be used directly inside a function call as a parameter.
```javascript
const x = [1,2,3];
display(list(...x)); // Valid
display(list((...x)); // Not valid
```
The second use of the spread syntax will throw an error.

### [No expressions in template literals](rules/templateLiteral.ts)
**Error message**: `Expressions not allowed in template literal`

In Source, template literals are only used for multiline string, they cannot contain expressions.
```javascript
const x = `10 * 10 = ${10*10}`
```
The expression `10*10` will throw an error.

### [No multiple declarations](rules/variableDeclaration.ts)  
**Error message**: `Multiple declarations not allowed`

In Source, only 1 declaration is allowed in each variable declarator.
```javascript
const x = 1, y = 2, z = 3;
```
The whole statement will throw an error.

### [Incomplete variable declaration](rules/variableDeclaration.ts)
**Error message**: `Incomplete variable declaration`

Detects whether left and right side of variable declaration in present;
```javascript
const x;
```
The whole statement will throw an error.

### [No let declaration](rules/variableDeclaration.ts)  
**Error message**: `Use keyword "const" instead to declare a constant`

Before Source 3, variables can only be declared with `const`
```javascript
let x = 1;
```
The whole statement will throw an error.

### [No while statement](rules/whileStatement.ts)  
**Error message**: `While statements are not allowed`

Before Source 3, while statements are not allowed.
```javascript
while(true) {
  display("hi")
}
```
`while(...)` will throw an error.

