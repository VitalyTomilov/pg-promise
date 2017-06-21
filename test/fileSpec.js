'use strict';

var path = require('path');
var fs = require('fs');
var header = require('./db/header');
var utils = require('../lib/utils');
var promise = header.defPromise;
var options = {
    promiseLib: promise,
    noWarnings: true
};
var dbHeader = header(options);
var pgp = dbHeader.pgp;
var db = dbHeader.db;

var QueryFileError = pgp.errors.QueryFileError;
var QueryFile = pgp.QueryFile;

var sqlSimple = getPath('./sql/simple.sql');
var sqlUsers = getPath('./sql/allUsers.sql');
var sqlUnknown = getPath('./sql/unknown.sql');
var sqlInvalid = getPath('./sql/invalid.sql');
var sqlParams = getPath('./sql/params.sql');
var sqlTemp = getPath('./sql/temp.sql');

function getPath(file) {
    return path.join(__dirname, file);
}

describe('QueryFile / Positive:', function () {

    describe('function-style call', () => {
        it('must return an object', () => {
            // eslint-disable-next-line
            expect(QueryFile(sqlSimple, {noWarnings: true}) instanceof QueryFile).toBe(true);
        });
    });

    describe('without options', function () {
        var qf = new QueryFile(sqlSimple, {noWarnings: true});
        it('must not minify', function () {
            expect(qf.query).toBe('select 1; --comment');
        });
    });

    describe('with minify=true && debug=true', function () {
        var qf = new QueryFile(sqlUsers, {debug: true, minify: true, noWarnings: true});
        it('must return minified query', function () {
            expect(qf.query).toBe('select * from users');
        });
        it('must count parameters', function () {
            expect(qf.paramCount).toBe(0);
        });
    });

    describe('default with params', function () {
        var params = {
            schema: 'public',
            table: 'users'
        };
        var qf = new QueryFile(sqlParams, {minify: true, params: params, noWarnings: true});
        it('must return pre-formatted query', function () {
            expect(qf.query).toBe('SELECT ${column~} FROM "public"."users"');
        });
        it('must count parameters', function () {
            expect(qf.paramCount).toBe(1);
        });
    });

    describe('compression with params', function () {
        var params = {
            schema: 'public',
            table: 'users',
            column: 'col'
        };
        var qf1 = new QueryFile(sqlParams, {minify: true, compress: true, params: params, noWarnings: true});
        it('must return uncompressed replacements by default', function () {
            expect(qf1.query).toBe('SELECT "col" FROM "public"."users"');
        });
        var qf2 = new QueryFile(sqlParams, {minify: 'after', compress: true, params: params, noWarnings: true});
        it('must return compressed replacements for \'after\'', function () {
            expect(qf2.query).toBe('SELECT"col"FROM"public"."users"');
        });
    });

    describe('non-minified query', function () {
        var result;
        beforeEach(function (done) {
            db.query(new QueryFile(sqlUsers, {noWarnings: true}))
                .then(function (data) {
                    result = data;
                    done();
                });
        });
        it('must resolve with data', function () {
            expect(result instanceof Array).toBe(true);
            expect(result.length > 0).toBe(true);
        });
    });

    describe('minified query', function () {
        var result;
        beforeEach(function (done) {
            db.query(new QueryFile(sqlUsers, {minify: true, noWarnings: true}))
                .then(function (data) {
                    result = data;
                    done();
                });
        });
        it('must resolve with data', function () {
            expect(result instanceof Array).toBe(true);
            expect(result.length > 0).toBe(true);
        });
    });

    describe('compressed query', function () {
        var result, sql;
        beforeEach(function (done) {
            sql = new QueryFile(sqlUsers, {compress: true, noWarnings: true});
            db.query(sql)
                .then(function (data) {
                    result = data;
                    done();
                });
        });
        it('must resolve with data', function () {
            expect(sql.query).toBe('select*from users');
            expect(result instanceof Array).toBe(true);
            expect(result.length > 0).toBe(true);
        });
    });

    describe('property options', function () {
        var options1 = {
            debug: utils.isDev(),
            minify: false,
            compress: false,
            noWarnings: true
        }, options2 = {
            debug: false,
            compress: true,
            noWarnings: true
        }, options3 = {
            debug: false,
            minify: true,
            compress: true,
            noWarnings: true
        };
        Object.freeze(options1);
        Object.freeze(options3);
        it('must be consistent with the settings', function () {
            expect(new QueryFile(sqlSimple, {noWarnings: true}).options).toEqual(options1);
            expect(new QueryFile(sqlSimple, options2).options).toEqual(options3);
        });
    });

    describe('inspect', function () {
        var qf = new QueryFile(sqlSimple, {noWarnings: true});
        it('must return the query', function () {
            expect(qf.inspect()).toBe(qf.toString());
        });
    });

    describe('modified file', function () {
        var q1 = 'select 1';
        var q2 = 'select 2';
        it('must be read again', function () {
            fs.writeFileSync(sqlTemp, q1);
            var qf = new QueryFile(sqlTemp, {debug: true});
            expect(qf.query).toBe(q1);
            expect(qf.error).toBeUndefined();

            fs.writeFileSync(sqlTemp, q2);
            var t = new Date();
            t.setTime(t.getTime() + 60 * 60 * 1000);
            fs.utimesSync(sqlTemp, t, t);
            qf.prepare();
            expect(qf.query).toBe(q2);
            expect(qf.error).toBeUndefined();
        });
    });

    describe('repeated read', function () {
        // this is just for code coverage;
        it('must not read again', function () {
            var qf = new QueryFile(sqlSimple, {debug: false, minify: true, noWarnings: true});
            qf.prepare();
            qf.prepare();
            expect(qf.query).toBe('select 1;');
        });
    });
});

describe('QueryFile / Negative:', function () {

    describe('non-minified query', function () {
        var error;
        beforeEach(function (done) {
            db.query(new QueryFile(sqlUnknown))
                .catch(function (err) {
                    error = err;
                    done();
                });
        });
        it('must reject with an error', function () {
            expect(error instanceof Error).toBe(true);
        });
    });

    describe('inspect', function () {
        var qf = new QueryFile(sqlInvalid, {minify: true, noWarnings: true});
        it('must return the error', function () {
            expect(qf.inspect() != qf.toString(1)).toBe(true);
            expect(qf.error instanceof QueryFileError).toBe(true);
            expect(qf.error.inspect()).toBe(qf.error.toString());
        });
    });

    describe('accessing a temporary file', function () {
        var error, query = 'select 123 as value';
        it('must result in error once deleted', function () {
            fs.writeFileSync(sqlTemp, query);
            var qf = new QueryFile(sqlTemp, {debug: true, noWarnings: true});
            expect(qf.query).toBe(query);
            expect(qf.error).toBeUndefined();
            fs.unlinkSync(sqlTemp);
            qf.prepare();
            expect(qf.query).toBeUndefined();
            expect(qf.error instanceof Error).toBe(true);
        });

        it('must throw when preparing', function () {
            fs.writeFileSync(sqlTemp, query);
            var qf = new QueryFile(sqlTemp, {debug: true, noWarnings: true});
            expect(qf.query).toBe(query);
            expect(qf.error).toBeUndefined();
            fs.unlinkSync(sqlTemp);
            try {
                qf.prepare(true);
            } catch (e) {
                error = e;
            }
            expect(qf.query).toBeUndefined();
            expect(error instanceof Error).toBe(true);
        });

    });

    describe('invalid sql', function () {
        it('must throw an error', function () {
            var qf = new QueryFile(sqlInvalid, {minify: true, noWarnings: true});
            expect(qf.error instanceof QueryFileError).toBe(true);
            expect(qf.error.file).toBe(sqlInvalid);
        });
    });

});
