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
const x = 1;
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

Only permitted operators defined in Source is allowed. Binary operators like `^` or `instanceof` is banned.
```javascript
100^5;
```
The expression `100^5` will throw an error.

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

Detects when a function application has not enough parameters.
```javascript
display();
```
The call to `display` needs at least 1 element.
