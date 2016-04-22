'use strict';

/*
 *
 * This type of error should be rejected with when running a query fails.
 * It can also dissect and improve on the error structure, to unify it.
 * 
 * */

var EOL = require('os').EOL;

/**
 *
 * @constructor
 */
function QueryError(message) {
    var temp = Error.apply(this, arguments);
    temp.name = this.name = 'QueryError';
    this.stack = temp.stack;
    this.message = message;
}

QueryError.prototype = Object.create(Error.prototype, {
    constructor: {
        value: QueryError,
        writable: true,
        configurable: true
    }
});

QueryError.prototype.toString = function () {
    return "QueryError {" + EOL + '    ' + this.message + EOL + '}';
};

QueryError.prototype.inspect = function () {
    return this.toString();
};

module.exports = QueryError;