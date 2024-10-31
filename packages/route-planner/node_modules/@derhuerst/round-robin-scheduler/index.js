'use strict'

const RoundRobin = {
	init: function (values) {
		if (!Array.isArray(values)) throw new Error('values must be an array')
		this.values = Array.from(values)
		this.length = this.values.length
		this.i = 0
	},

	get: function () {
		if (this.i >= this.length) {
			this.i = 1
			return this.values[0]
		}
		return this.values[this.i++]
	},

	has: function (val) {
		return this.values.indexOf(val) >= 0
	},
	findIndex: function (fn) {
		return this.values.findIndex(fn)
	},

	add: function (val) {
		this.values.push(val)
		return this.length++
	},
	remove: function (i) {
		if (i < 0 || i > this.length) return false
		this.values.splice(i, 1)
		this.length--
		return true
	}
}

const createRoundRobinScheduler = (values) => {
	const roundRobin = Object.create(RoundRobin)
	roundRobin.init(values || [])
	return roundRobin
}

createRoundRobinScheduler.RoundRobin = RoundRobin
module.exports = createRoundRobinScheduler
