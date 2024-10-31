'use strict'

const br2nl = require('.')

console.log(br2nl('foo<br>bar'))
console.log(br2nl('foo<br> bar'))
console.log(br2nl('foo<br/>bar'))
console.log(br2nl('foo<br />bar'))
console.log(br2nl('foo<br a="b" />bar'))
