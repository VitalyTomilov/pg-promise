'use strict';

/*eslint-disable */

var capture = require('./db/capture');
var PromiseAdapter = require('../lib/index').PromiseAdapter;
var supportsPromise = typeof(Promise) !== 'undefined';

var header = require('./db/header');
var promise = header.defPromise;
var options = {
    promiseLib: promise,
    noWarnings: true
};
var dbHeader = header(options);
var pgp = dbHeader.pgp;
var db = dbHeader.db;

var BatchError = pgp.spex.errors.BatchError;

function dummy() {
}

describe("Library entry function", function () {

    describe("without any promise override", function () {
        it("must return a valid library object", function () {
            if (supportsPromise) {
                var lib = header({noWarnings: true});
                expect(typeof(lib.pgp)).toBe('function');
            } else {
                expect(function () {
                    header();
                }).toThrow("Promise library must be specified.");
            }
        })
    });

    describe("with PromiseAdapter override", function () {
        var p = header.defPromise;

        function create(func) {
            return new p(func);
        }

        function resolve(data) {
            return p.resolve(data);
        }

        function reject(reason) {
            return p.reject(reason);
        }

        var adapter = new PromiseAdapter(create, resolve, reject);
        it("must accept custom promise", function () {
            var lib = header({
                promiseLib: adapter,
                noWarnings: true
            });
            expect(lib.pgp instanceof Function).toBe(true);
        })

        describe("using PromiseAdapter", function () {
            var result;
            beforeEach(function (done) {
                var lib = header({
                    promiseLib: adapter,
                    noWarnings: true
                });
                lib.db.one("select 1 as value")
                    .then(function (data) {
                        result = data;
                        done();
                    });
            });
            it("must return successfully", function () {
                expect(result.value).toBe(1);
            });
        });
    });

    if (supportsPromise) {
        describe("without any options", function () {
            var result;
            beforeEach(function (done) {
                var db = header({noWarnings: true}).db;
                db.query("select * from users")
                    .then(function (data) {
                        result = data;
                        done();
                    });
            });
            it("must be able to execute queries", function () {
                expect(result instanceof Array).toBe(true);
            })
        });
    }

    describe("with a valid promise library-object override", function () {
        it("must return a valid library object", function () {
            var lib = header(
                {
                    promiseLib: {
                        resolve: dummy,
                        reject: dummy
                    },
                    noWarnings: true
                });
            expect(typeof(lib.pgp)).toBe('function');
        })
    });

    describe("with a valid promise library-function override", function () {
        it("must return a valid library object", function () {
            function fakePromiseLib() {
            }

            fakePromiseLib.resolve = dummy;
            fakePromiseLib.reject = dummy;
            var lib = header({
                promiseLib: fakePromiseLib,
                noWarnings: true
            });
            expect(typeof(lib.pgp)).toBe('function');
        })
    });

    describe("with invalid promise override", function () {
        var error = "Invalid promise library specified.";
        it("must throw the correct error", function () {
            expect(function () {
                header({
                    promiseLib: "test"
                });
            })
                .toThrow(error);
            expect(function () {
                header({
                    promiseLib: dummy
                });
            })
                .toThrow(error);
        });
    });

    describe('with invalid options parameter', function () {
        var errBody = 'Invalid initialization options: ';
        it("must throw an error", function () {
            expect(() => {
                header(123);
            }).toThrow(new TypeError(errBody + '123'));
            expect(() => {
                header('hello');
            }).toThrow(new TypeError(errBody + '"hello"'));
        });
    });

    describe("with defaults for pg", function () {
        it("must return a valid library object", function () {
            var lib = header({
                defaults: {
                    parseInputDatesAsUTC: true
                }
            });
            expect(typeof(lib.pgp)).toBe('function');
            expect(lib.pgp.pg.defaults.parseInputDatesAsUTC).toBe(true);
        })
    });

    describe("with invalid options", function () {
        var txt;
        beforeEach(function (done) {
            var c = capture();
            header({test: 123});
            txt = c();
            done();
        });

        it("must throw an error", function () {
            expect(txt).toContain("WARNING: Invalid property 'test' in initialization options.");
        });
    });

    describe("multi-init", function () {

        var PromiseOne = [
            function (cb) {
                return new promise.Promise(cb);
            },
            function (data) {
                return promise.resolve(data);
            },
            function (reason) {
                return promise.reject('reject-one');
            }
        ];

        var PromiseTwo = [
            function (cb) {
                return new promise.Promise(cb);
            },
            function (data) {
                return promise.resolve(data);
            },
            function () {
                return promise.reject('reject-two');
            }
        ];

        var one = PromiseAdapter.apply(null, PromiseOne);
        var two = PromiseAdapter.apply(null, PromiseTwo);
        var result;

        beforeEach(function (done) {
            var pg1 = header({promiseLib: one, noWarnings: true}), db1 = pg1.db;
            var pg2 = header({promiseLib: two, noWarnings: true}), db2 = pg2.db;
            db.task(t => {
                return t.batch([
                    db1.query('select $1', []), db2.query('select $1', [])
                ])
            })
                .catch(error => {
                    result = error;
                    done();
                });
        });

        it("must be supported", function () {
            expect(result instanceof BatchError).toBe(true);
            expect(result.data).toEqual([
                {
                    success: false,
                    result: 'reject-one'
                },
                {
                    success: false,
                    result: 'reject-two'
                }
            ]);
        });
    });

    describe('Taking no initilization options', function () {
        it('must be supported', function () {
            expect(typeof dbHeader.pgpLib()).toBe('function');
        });
    });
});

if (jasmine.Runner) {
    var _finishCallback = jasmine.Runner.prototype.finishCallback;
    jasmine.Runner.prototype.finishCallback = function () {
        // Run the old finishCallback:
        _finishCallback.bind(this)();

        pgp.end(); // closing pg database application pool;
    };
}
