/**
 * Created by tinyiko on 2017/04/22.
 */
"use strict";

var logger = require("./config/logutil").logger;
var _ = require("underscore");

function decimalToBinary(DecimalValue){
    var BinaryValue = '';
    // Loop from 2^64/2 to 1
    for (var i=64; i>=1; i--){
        // Is 2^i/2 within DecimalValue?
        if(DecimalValue >= Math.pow(2,i)/2){
            // If so, add a 1 to BinaryValue and subtract 2^i/2 from DecimalValue
            BinaryValue = BinaryValue+'1';
            DecimalValue = DecimalValue - (Math.pow(2,i)/2);
        }
        else if(BinaryValue.indexOf("1") != -1){
            // If not, add a 0, but only if there is already a 1 in the value
            BinaryValue = BinaryValue+'0';
        }
    }
    return BinaryValue;
};

var deepCopy = function  (arr) {
    var out = [];
    for (var i = 0, len = arr.length; i < len; i++) {
        var item = arr[i];
        var obj = {};
        for (var k in item) {
            obj[k] = item[k];
        }
        out.push(obj);
    }
    return out;
}

var arrayClone = function ( arr ) {
    if( _.isArray( arr ) ) {
        return _.map( arr, arrayClone );
    } else if( typeof arr === 'object' ) {
        throw 'Cannot clone array containing an object!';
    } else {
        return arr;
    }
}

exports.decimalToBinary = decimalToBinary

var copy = arrayClone(['a','b','c']);
var copy1 = deepCopy(['a','b','c']);

logger.log('copied array1 = ' + JSON.stringify(copy))
logger.log("copied array = " + JSON.stringify(copy1));