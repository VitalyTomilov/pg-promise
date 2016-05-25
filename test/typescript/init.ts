/// <reference path='../../typescript/pg-promise' />

import * as pgPromise from 'pg-promise';

var pgp = pgPromise({
    capSQL: true,
    pgFormatting: true,
    pgNative: true
});

interface Test {
    hello:string;
}

var db = <pgPromise.IDatabase<Test>&Test>pgp('connection');

db.one('');

db.one(new pgPromise.QueryFile(''));

var txMode:any = new pgPromise.txMode.TransactionMode();

function myTransaction(t:any) {
}

var txFunc:any = myTransaction;
txFunc['txMode'] = txMode;
txFunc.txMode = txMode;

db.tx(function (t) {
    var w = t.one('');
    var q = t.hello;
});
