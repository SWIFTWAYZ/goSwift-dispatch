/**
 * Created by tinyiko on 2017/04/22.
 */
"use strict";

var logger = require("./config/logutil").logger;
var _ = require("underscore");
var lineReader = require('line-reader');
var Promise = require("bluebird");

var line_counter = 0;
var unreached = [];
var gpsPoint = function (lat, lon,id) {
    this.latitude = lat;
    this.longitude = lon;
    this.vehicle_id = id;
}

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

    var readDriversGPS = function (filename,vehicle_id) {
    var readLine = Promise.promisify(lineReader.eachLine);
    var promise = new Promise(function (resolve, reject) {
        readLine(filename, function (line, last) {
            var line_str = line.split(",");
            unreached[line_counter] = new gpsPoint(line_str[0], line_str[1],vehicle_id);
            line_counter++;
            if (last) {
                // or check if it's the last one
                console.log("last item = " + last + "=" + line_counter);
            }
        }).then(function (results) {
            //console.log("readline results :"+results);
            resolve(unreached);
        }).catch(function (error) {
            reject(error.toString());
        });
    });
    return promise;
}

exports.decimalToBinary = decimalToBinary;
exports.readDriversGPS = readDriversGPS;


