# round-robin-scheduler

**A [round-robin](https://en.wikipedia.org/wiki/Round-robin_scheduling) [scheduler](https://en.wikipedia.org/wiki/Scheduling_(computing)), compatible with the [`abstract-scheduler` interface](https://www.npmjs.com/package/abstract-scheduler).**

[![compatible with abstract-scheduler](https://unpkg.com/abstract-scheduler@3/badge.svg)](https://github.com/derhuerst/abstract-scheduler)

[![npm version](https://img.shields.io/npm/v/@derhuerst/round-robin-scheduler.svg)](https://www.npmjs.com/package/@derhuerst/round-robin-scheduler)
[![build status](https://api.travis-ci.org/derhuerst/round-robin-scheduler.svg?branch=master)](https://travis-ci.org/derhuerst/round-robin-scheduler)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/round-robin-scheduler.svg)
[![chat with me on Gitter](https://img.shields.io/badge/chat%20with%20me-on%20gitter-512e92.svg)](https://gitter.im/derhuerst)
[![support me on Patreon](https://img.shields.io/badge/support%20me-on%20patreon-fa7664.svg)](https://patreon.com/derhuerst)


## Installation

```shell
npm install @derhuerst/round-robin-scheduler
```


## Usage

```js
const createRoundRobin = require('@derhuerst/round-robin-scheduler')

const roundRobin = createRoundRobin(['foo', 'bar'])

roundRobin.get() // foo
roundRobin.get() // bar
roundRobin.add('baz') // 2
roundRobin.length // 3
roundRobin.get() // baz
roundRobin.remove(0) // remove first item
roundRobin.get() // bar
```

`roundRobin` is compatible with the [`abstract-scheduler` interface](https://www.npmjs.com/package/abstract-scheduler).


## Contributing

If you have a question or need support using `round-robin-scheduler`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, refer to [the issues page](https://github.com/derhuerst/round-robin-scheduler/issues).
