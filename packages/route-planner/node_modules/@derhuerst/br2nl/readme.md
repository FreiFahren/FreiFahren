# br2nl

Yet another function to **replace HTML `<br>` tags with [newline characters](https://en.wikipedia.org/wiki/Newline)**.

*Note:* This package does *not* do [HTML sanitization](https://en.wikipedia.org/wiki/HTML_sanitization)! It merely replaces `<br>`.

[![npm version](https://img.shields.io/npm/v/br2nl.svg)](https://www.npmjs.com/package/br2nl)
[![build status](https://api.travis-ci.org/derhuerst/br2nl.svg?branch=master)](https://travis-ci.org/derhuerst/br2nl)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/br2nl.svg)
[![chat with me on Gitter](https://img.shields.io/badge/chat%20with%20me-on%20gitter-512e92.svg)](https://gitter.im/derhuerst)
[![support me on Patreon](https://img.shields.io/badge/support%20me-on%20patreon-fa7664.svg)](https://patreon.com/derhuerst)


## Installation

```shell
npm install @derhuerst/br2nl
```


## Usage

```js
const br2nl = require('@derhuerst/br2nl')

console.log(br2nl('foo<br>bar'))
console.log(br2nl('foo<br> bar'))
console.log(br2nl('foo<br/>bar'))
console.log(br2nl('foo<br />bar'))
console.log(br2nl('foo<br a="b" />bar'))
```


## Contributing

If you have a question or need support using `br2nl`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, refer to [the issues page](https://github.com/derhuerst/br2nl/issues).
