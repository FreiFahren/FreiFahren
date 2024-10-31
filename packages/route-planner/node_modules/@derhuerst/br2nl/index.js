'use strict'

const regex = /<br\b[^>]*>/gi

const br2nl = html => html.replace(regex, '\n')

module.exports = br2nl
